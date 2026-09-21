using System.Collections.ObjectModel;
using System.Globalization;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Threading;
using SocketIOClient;
using Rudemir.AdminConsole.Services;

namespace Rudemir.AdminConsole;

public record BookingRow(string Id, string Starts, string Ends, string Seat, string Guest, string Phone, string Tariff, string Status, bool Active);
public record GuestRow(string Id, string Name, string Phone, string Balance, string Bonus, int Sessions, string Cards);
public record OrderRow(string Id, string Time, string Items, string Guest, string Total, string Status, bool Open);
public record CartLine(string ProductId, string Line, string Sum);

public partial class MainWindow : Window
{
    private static readonly CultureInfo Ru = new("ru-BY");
    private readonly ApiClient _api = new();
    private SocketIOClient.SocketIO? _socket;
    private readonly DispatcherTimer _poll = new() { Interval = TimeSpan.FromSeconds(10) };
    private readonly DispatcherTimer _debounce = new() { Interval = TimeSpan.FromMilliseconds(300) };
    private Action? _debounced;

    private string _clubId = "";
    private JsonElement _club;
    private List<JsonElement> _seats = new();
    private JsonElement? _selectedSeat;
    private readonly HashSet<string> _bulk = new();
    private string? _startGuestId;
    private string? _bkGuestId;
    private string? _cashGuestId;
    private string? _selectedGuestId;
    private readonly Dictionary<string, int> _cart = new();
    private List<JsonElement> _products = new();
    private JsonElement? _openShift;
    private List<JsonElement> _calls = new();

    public MainWindow()
    {
        InitializeComponent();
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
            if (File.Exists(path))
            {
                using var doc = JsonDocument.Parse(File.ReadAllText(path));
                var api = doc.RootElement.GetProperty("ApiBase").GetString();
                if (!string.IsNullOrWhiteSpace(api)) _api.BaseUrl = api;
            }
            var env = Environment.GetEnvironmentVariable("RUDEMIR_API_BASE");
            if (!string.IsNullOrWhiteSpace(env)) _api.BaseUrl = env;
            if (string.IsNullOrWhiteSpace(_api.BaseUrl)) _api.BaseUrl = "http://localhost:3000";
        }
        catch { /* defaults */ }

        _poll.Tick += async (_, _) => await SafeAsync(RefreshCurrentTabAsync);
        _debounce.Tick += (_, _) => { _debounce.Stop(); _debounced?.Invoke(); };

        for (var h = 10; h <= 23; h++) BkHour.Items.Add(new ComboBoxItem { Content = $"{h:00}:00", Tag = h });
        BkHour.SelectedIndex = 8;
        for (var h = 1; h <= 6; h++) BkHours.Items.Add(new ComboBoxItem { Content = $"{h} ч", Tag = h });
        BkHours.SelectedIndex = 0;
        BkDate.SelectedDate = DateTime.Today;
    }

    // ---------- auth ----------

    private async void Login_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            LoginError.Text = "";
            var tokens = await _api.PostAsync("/api/v1/auth/login", new { phone = PhoneBox.Text.Trim(), password = PasswordBox.Password });
            _api.SetToken(tokens.GetProperty("accessToken").GetString());
            var me = await _api.GetAsync("/api/v1/auth/me");
            WhoLabel.Text = me.GetProperty("displayName").GetString();

            var roles = me.GetProperty("clubRoles").EnumerateArray()
                .Where(r => r.GetProperty("role").GetString() is "OWNER" or "CLUB_ADMIN" or "TECH_ADMIN" or "MANAGER" or "SUPPORT")
                .Select(r => r.GetProperty("clubId").GetString()!).ToList();
            var isSuper = me.GetProperty("globalRole").GetString() is "SUPERADMIN" or "SUPPORT";
            var all = await _api.GetAsync("/api/v1/clubs");
            var mine = all.EnumerateArray().Where(c => isSuper || roles.Contains(c.GetProperty("id").GetString()!)).ToList();
            if (mine.Count == 0) { LoginError.Text = "У аккаунта нет роли в клубе."; return; }

            ClubBox.Items.Clear();
            foreach (var c in mine) ClubBox.Items.Add(new ComboBoxItem { Content = c.GetProperty("name").GetString(), Tag = c.GetProperty("id").GetString() });
            ClubBox.Visibility = mine.Count > 1 ? Visibility.Visible : Visibility.Collapsed;
            ClubBox.SelectedIndex = 0;
            _clubId = mine[0].GetProperty("id").GetString()!;

            await LoadClubAsync();
            await ConnectWsAsync(_api.AccessToken!);
            PasswordBox.Clear();
            LogoutBtn.Visibility = Visibility.Visible;
            LoginOverlay.Visibility = Visibility.Collapsed;
            _poll.Start();
        }
        catch (Exception ex) { LoginError.Text = ex.Message; }
    }

    private async void Logout_Click(object sender, RoutedEventArgs e)
    {
        _poll.Stop();
        if (_socket is not null) { try { await _socket.DisconnectAsync(); } catch { } _socket.Dispose(); _socket = null; }
        _api.SetToken(null);
        LogoutBtn.Visibility = Visibility.Collapsed;
        LoginOverlay.Visibility = Visibility.Visible;
    }

    private async void ClubBox_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (ClubBox.SelectedItem is ComboBoxItem item && item.Tag is string id && id != _clubId && _api.AccessToken is not null)
        {
            _clubId = id;
            await SafeAsync(LoadClubAsync);
            if (_socket is not null) await _socket.EmitAsync("join_club", new { clubId = _clubId });
        }
    }

    private async Task LoadClubAsync()
    {
        _club = await _api.GetAsync($"/api/v1/clubs/{_clubId}");
        ClubLabel.Text = _club.GetProperty("name").GetString();
        FillTariffs(TariffBox);
        FillTariffs(BkTariffBox);
        await RefreshCurrentTabAsync();
        await LoadShiftHeaderAsync();
    }

    private void FillTariffs(ComboBox box)
    {
        box.Items.Clear();
        foreach (var t in _club.GetProperty("tariffs").EnumerateArray())
            box.Items.Add(new ComboBoxItem { Content = $"{t.GetProperty("name").GetString()} · {Money(t.GetProperty("pricePerHourKopecks").GetInt32())}/ч", Tag = t.GetProperty("id").GetString() });
        if (box.Items.Count > 0) box.SelectedIndex = 0;
    }

    private async Task ConnectWsAsync(string token)
    {
        _socket?.Dispose();
        _socket = new SocketIOClient.SocketIO(_api.BaseUrl, new SocketIOOptions { Auth = new Dictionary<string, string> { ["token"] = token } });
        _socket.OnAny((name, resp) => Dispatcher.InvokeAsync(async () =>
        {
            if (name == "admin.call") LogLabel.Text = $"{DateTime.Now:HH:mm} Вызов администратора с ПК";
            if (name is "seat.updated" or "session.updated" or "booking.updated" or "admin.call")
                await SafeAsync(RefreshCurrentTabAsync);
        }));
        await _socket.ConnectAsync();
        await _socket.EmitAsync("join_club", new { clubId = _clubId });
    }

    private async void Tabs_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (e.Source != Tabs || _api.AccessToken is null) return;
        await SafeAsync(RefreshCurrentTabAsync);
    }

    private async Task RefreshCurrentTabAsync()
    {
        if (string.IsNullOrEmpty(_clubId)) return;
        switch (Tabs.SelectedIndex)
        {
            case 0: await RefreshHallAsync(); break;
            case 1: await RefreshBookingsAsync(); break;
            case 2: await RefreshGuestsAsync(); break;
            case 3: await RefreshCashAsync(); break;
            case 4: await RefreshShiftAsync(); break;
        }
    }

    // ---------- hall ----------

    private async Task RefreshHallAsync()
    {
        var map = await _api.GetAsync($"/api/v1/clubs/{_clubId}/seat-map");
        _seats = map.EnumerateArray().ToList();
        HallSummary.Text = $"Занято {_seats.Count(s => Str(s, "status") == "OCCUPIED")} из {_seats.Count}";
        ZonesPanel.Children.Clear();
        foreach (var zone in _seats.GroupBy(s => Str(s, "zoneName")))
        {
            ZonesPanel.Children.Add(new TextBlock { Text = zone.Key, Foreground = (Brush)FindResource("Mute"), Margin = new Thickness(0, 8, 0, 4) });
            var wrap = new WrapPanel();
            foreach (var seat in zone) wrap.Children.Add(BuildTile(seat));
            ZonesPanel.Children.Add(wrap);
        }
        if (_selectedSeat is JsonElement sel)
        {
            var id = Str(sel, "id");
            var fresh = _seats.FirstOrDefault(s => Str(s, "id") == id);
            if (fresh.ValueKind == JsonValueKind.Object) SelectSeat(fresh);
        }
        BulkCount.Text = _bulk.Count.ToString();
        TransferBox.Items.Clear();
        TransferBox.Items.Add(new ComboBoxItem { Content = "Выберите ПК", Tag = "" });
        foreach (var s in _seats.Where(s => Str(s, "status") == "FREE"))
            TransferBox.Items.Add(new ComboBoxItem { Content = $"{Str(s, "zoneName")} · {Str(s, "label")}", Tag = Str(s, "id") });
        TransferBox.SelectedIndex = 0;
    }

    private UIElement BuildTile(JsonElement seat)
    {
        var status = Str(seat, "status");
        var (bg, fg) = status switch
        {
            "OCCUPIED" => ("#4A1F2B", "#FF8FA3"),
            "RESERVED" => ("#3A3220", "#E0B84A"),
            "MAINTENANCE" or "OFFLINE" => ("#2A2433", "#8B829C"),
            _ => ("#1F4A3C", "#3DDC97"),
        };
        var id = Str(seat, "id");
        var selected = _selectedSeat is JsonElement s && Str(s, "id") == id;
        var tile = new Border
        {
            Width = 168, Height = 96, Margin = new Thickness(0, 0, 10, 10), CornerRadius = new CornerRadius(4), Padding = new Thickness(10),
            Background = Brush(bg), BorderBrush = selected ? (Brush)FindResource("Gold") : Brushes.Transparent, BorderThickness = new Thickness(2),
            Cursor = System.Windows.Input.Cursors.Hand,
        };
        var grid = new Grid();
        var stack = new StackPanel();
        var head = new DockPanel();
        head.Children.Add(new TextBlock { Text = Str(seat, "label"), FontSize = 17, FontWeight = FontWeights.SemiBold, Foreground = Brush(fg) });
        head.Children.Add(new TextBlock { Text = StatusRu(status), FontSize = 11, Foreground = Brush(fg), HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 4, 22, 0) });
        stack.Children.Add(head);
        stack.Children.Add(new TextBlock { Text = Str(seat, "guestName") is { Length: > 0 } g ? g : "—", Foreground = Brush(fg), Margin = new Thickness(0, 6, 0, 0), TextTrimming = TextTrimming.CharacterEllipsis });
        var sub = seat.TryGetProperty("sessionId", out var sid) && sid.ValueKind == JsonValueKind.String
            ? $"{Remaining(seat)} · {(seat.TryGetProperty("balanceKopecks", out var b) && b.ValueKind == JsonValueKind.Number ? Money(b.GetInt32()) : "")}"
            : Str(seat, "currentProcess");
        stack.Children.Add(new TextBlock { Text = sub, FontSize = 11, Foreground = Brush(fg), Opacity = 0.8 });
        grid.Children.Add(stack);
        var cb = new CheckBox { IsChecked = _bulk.Contains(id), HorizontalAlignment = HorizontalAlignment.Right, VerticalAlignment = VerticalAlignment.Top };
        cb.Checked += (_, _) => { _bulk.Add(id); BulkCount.Text = _bulk.Count.ToString(); };
        cb.Unchecked += (_, _) => { _bulk.Remove(id); BulkCount.Text = _bulk.Count.ToString(); };
        grid.Children.Add(cb);
        tile.Child = grid;
        tile.MouseLeftButtonUp += (_, _) => SelectSeat(seat);
        return tile;
    }

    private void SelectSeat(JsonElement seat)
    {
        _selectedSeat = seat;
        var status = Str(seat, "status");
        SelectedLabel.Text = $"{Str(seat, "label")} · {StatusRu(status)}";
        var hasSession = seat.TryGetProperty("sessionId", out var sid) && sid.ValueKind == JsonValueKind.String;
        SelectedInfo.Text = hasSession
            ? $"Гость: {Str(seat, "guestName")}\nОсталось: {Remaining(seat)}\nБаланс: {(seat.TryGetProperty("balanceKopecks", out var b) && b.ValueKind == JsonValueKind.Number ? Money(b.GetInt32()) : "—")}"
            : (seat.TryGetProperty("lastHeartbeatAt", out var hb) && hb.ValueKind == JsonValueKind.String
                ? $"Агент: {DateTime.Parse(hb.GetString()!).ToLocalTime():HH:mm}{(seat.TryGetProperty("hostname", out var hn) && hn.ValueKind == JsonValueKind.String ? " · " + hn.GetString() : "")}{(seat.TryGetProperty("agentPaired", out var ap) && ap.ValueKind == JsonValueKind.False ? " (не привязан)" : "")}"
                : (seat.TryGetProperty("agentPaired", out var paired) && paired.ValueKind == JsonValueKind.True ? "Агент привязан, heartbeat нет" : "Агент не привязан"));
        if (PairCodeLabel is not null) PairCodeLabel.Text = "";
        StartPane.Visibility = hasSession ? Visibility.Collapsed : Visibility.Visible;
        SessionPane.Visibility = hasSession ? Visibility.Visible : Visibility.Collapsed;
        PauseBtn.Content = Str(seat, "sessionStatus") == "PAUSED" ? "Продолжить" : "Пауза";
        MaintBtn.Content = status == "MAINTENANCE" ? "Вернуть в зал" : "Технический режим";
        foreach (var child in ZonesPanel.Children.OfType<WrapPanel>())
            foreach (var t in child.Children.OfType<Border>())
                t.BorderBrush = Brushes.Transparent;
        _ = RefreshHallTilesHighlightAsync();
    }

    private Task RefreshHallTilesHighlightAsync()
    {
        var id = _selectedSeat is JsonElement s ? Str(s, "id") : "";
        foreach (var child in ZonesPanel.Children.OfType<WrapPanel>())
            foreach (var t in child.Children.OfType<Border>())
            {
                var st = ((t.Child as Grid)?.Children[0] as StackPanel);
                // match by label text
                var lbl = ((st?.Children[0] as DockPanel)?.Children[0] as TextBlock)?.Text;
                var seat = _seats.FirstOrDefault(x => Str(x, "label") == lbl);
                t.BorderBrush = seat.ValueKind == JsonValueKind.Object && Str(seat, "id") == id ? (Brush)FindResource("Gold") : Brushes.Transparent;
            }
        return Task.CompletedTask;
    }

    private void GuestSearch_Changed(object sender, TextChangedEventArgs e) =>
        Debounce(() => _ = SuggestGuestsAsync(GuestSearchBox.Text, GuestSuggest));

    private void GuestSuggest_Selected(object sender, SelectionChangedEventArgs e)
    {
        if (GuestSuggest.SelectedItem is ListBoxItem li && li.Tag is string id)
        {
            _startGuestId = id;
            GuestSearchBox.TextChanged -= GuestSearch_Changed;
            GuestSearchBox.Text = li.Content?.ToString();
            GuestSearchBox.TextChanged += GuestSearch_Changed;
            GuestSuggest.Visibility = Visibility.Collapsed;
        }
    }

    private async Task SuggestGuestsAsync(string q, ListBox target)
    {
        if (q.Trim().Length < 2 || q.Contains('·')) { target.Visibility = Visibility.Collapsed; return; }
        try
        {
            var res = await _api.GetAsync($"/api/v1/clubs/{_clubId}/guests?q={Uri.EscapeDataString(q.Trim())}");
            target.Items.Clear();
            foreach (var g in res.EnumerateArray())
                target.Items.Add(new ListBoxItem { Content = $"{Str(g, "displayName")} · {Str(g, "phone")} · {Money(g.GetProperty("balanceKopecks").GetInt32())}", Tag = Str(g, "id"), Padding = new Thickness(8, 6, 8, 6) });
            target.Visibility = target.Items.Count > 0 ? Visibility.Visible : Visibility.Collapsed;
        }
        catch { /* ignore */ }
    }

    private async void Start_Click(object sender, RoutedEventArgs e)
    {
        if (_selectedSeat is not JsonElement seat || TariffBox.SelectedItem is not ComboBoxItem t) return;
        if (_startGuestId is null) { HallStatus.Text = "Выберите гостя из списка."; return; }
        var prepaid = ModePrepaid.IsChecked == true;
        await Do(HallStatus, "Сессия запущена", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/sessions", new
        {
            seatId = Str(seat, "id"),
            userId = _startGuestId,
            tariffId = (string)t.Tag,
            billingMode = prepaid ? "PREPAID" : "WALLET",
            prepaidMinutes = prepaid ? int.Parse(PrepaidBox.Text) : (int?)null,
        }), RefreshHallAsync);
    }

    private string? SessionId => _selectedSeat is JsonElement s && s.TryGetProperty("sessionId", out var id) && id.ValueKind == JsonValueKind.String ? id.GetString() : null;

    private async void Pause_Click(object sender, RoutedEventArgs e)
    {
        if (SessionId is null) return;
        var resume = _selectedSeat is JsonElement s && Str(s, "sessionStatus") == "PAUSED";
        await Do(HallStatus, resume ? "Сессия продолжена" : "Сессия на паузе", () => _api.PostAsync($"/api/v1/sessions/{SessionId}/{(resume ? "resume" : "pause")}"), RefreshHallAsync);
    }

    private async void Stop_Click(object sender, RoutedEventArgs e)
    {
        if (SessionId is null) return;
        await Do(HallStatus, "Сессия завершена", () => _api.PostAsync($"/api/v1/sessions/{SessionId}/stop"), RefreshHallAsync);
    }

    private async void Extend_Click(object sender, RoutedEventArgs e)
    {
        if (SessionId is null || !int.TryParse(MinutesBox.Text, out var m)) return;
        await Do(HallStatus, $"Продлено на {m} мин", () => _api.PostAsync($"/api/v1/sessions/{SessionId}/extend", new { minutes = m }), RefreshHallAsync);
    }

    private async void Transfer_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (SessionId is null || TransferBox.SelectedItem is not ComboBoxItem item || item.Tag is not string to || to.Length == 0) return;
        await Do(HallStatus, "Сессия перенесена", () => _api.PostAsync($"/api/v1/sessions/{SessionId}/transfer", new { toSeatId = to }), RefreshHallAsync);
    }

    private async void Command_Click(object sender, RoutedEventArgs e)
    {
        if (_selectedSeat is not JsonElement seat || sender is not Button b || b.Tag is not string cmd) return;
        await Do(HallStatus, $"Команда {cmd} отправлена", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/seats/{Str(seat, "id")}/command", new { command = cmd }), RefreshHallAsync);
    }

    private async void Pair_Click(object sender, RoutedEventArgs e)
    {
        if (_selectedSeat is not JsonElement seat) return;
        await Do(HallStatus, "Код агента создан — 15 минут", async () =>
        {
            var res = await _api.PostAsync($"/api/v1/clubs/{_clubId}/seats/{Str(seat, "id")}/pair");
            PairCodeLabel.Text = Str(res, "code");
            return res;
        }, () => Task.CompletedTask);
    }

    private async void Maintenance_Click(object sender, RoutedEventArgs e)
    {
        if (_selectedSeat is not JsonElement seat) return;
        var toFree = Str(seat, "status") == "MAINTENANCE";
        await Do(HallStatus, toFree ? "ПК вернулся в зал" : "ПК в техническом режиме", () => _api.PatchAsync($"/api/v1/seats/{Str(seat, "id")}", new { status = toFree ? "FREE" : "MAINTENANCE" }), RefreshHallAsync);
    }

    private async void Chat_Click(object sender, RoutedEventArgs e)
    {
        if (_selectedSeat is not JsonElement seat || ChatBox.Text.Trim().Length == 0) return;
        var body = ChatBox.Text.Trim();
        await Do(HallStatus, "Сообщение отправлено", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/chat", new { seatId = Str(seat, "id"), body }), () => Task.CompletedTask);
        ChatBox.Clear();
    }

    private async void BulkLock_Click(object sender, RoutedEventArgs e) => await BulkAsync("LOCK");
    private async void BulkUnlock_Click(object sender, RoutedEventArgs e) => await BulkAsync("UNLOCK");
    private async void BulkReboot_Click(object sender, RoutedEventArgs e) => await BulkAsync("REBOOT");
    private void BulkClear_Click(object sender, RoutedEventArgs e) { _bulk.Clear(); _ = SafeAsync(RefreshHallAsync); }

    private async Task BulkAsync(string cmd)
    {
        if (_bulk.Count == 0) { HallStatus.Text = "Отметьте ПК галочками."; return; }
        await Do(HallStatus, $"{cmd}: отправлено на {_bulk.Count} ПК", async () =>
        {
            foreach (var id in _bulk.ToList()) await _api.PostAsync($"/api/v1/clubs/{_clubId}/seats/{id}/command", new { command = cmd });
            return default;
        }, RefreshHallAsync);
        _bulk.Clear();
    }

    // ---------- bookings ----------

    private async Task RefreshBookingsAsync()
    {
        var all = BookingsAll.IsChecked == true;
        var res = await _api.GetAsync($"/api/v1/clubs/{_clubId}/bookings{(all ? "?all=1" : "")}");
        BookingsGrid.ItemsSource = res.EnumerateArray().Select(b =>
        {
            var st = Str(b, "status");
            return new BookingRow(Str(b, "id"),
                DateTime.Parse(Str(b, "startsAt")).ToLocalTime().ToString("dd.MM HH:mm"),
                DateTime.Parse(Str(b, "endsAt")).ToLocalTime().ToString("HH:mm"),
                Str(b.GetProperty("seat"), "label"),
                Str(b.GetProperty("user"), "displayName"),
                Str(b.GetProperty("user"), "phone"),
                Str(b.GetProperty("tariff"), "name"),
                BookingRu(st), st is "CONFIRMED" or "PENDING");
        }).ToList();

        BkSeatBox.Items.Clear();
        foreach (var z in _club.GetProperty("zones").EnumerateArray())
            foreach (var s in z.GetProperty("seats").EnumerateArray())
                BkSeatBox.Items.Add(new ComboBoxItem { Content = $"{Str(z, "name")} · {Str(s, "label")}", Tag = Str(s, "id") });
        if (BkSeatBox.Items.Count > 0 && BkSeatBox.SelectedIndex < 0) BkSeatBox.SelectedIndex = 0;
    }

    private async void Bookings_Reload(object sender, RoutedEventArgs e) => await SafeAsync(RefreshBookingsAsync);

    private async void Arrive_Click(object sender, RoutedEventArgs e)
    {
        if (BookingsGrid.SelectedItem is not BookingRow row) { BookingsStatus.Text = "Выберите бронь."; return; }
        await Do(BookingsStatus, $"Гость посажен на {row.Seat}", () => _api.PostAsync($"/api/v1/bookings/{row.Id}/arrive"), RefreshBookingsAsync);
    }

    private async void CancelBooking_Click(object sender, RoutedEventArgs e)
    {
        if (BookingsGrid.SelectedItem is not BookingRow row) { BookingsStatus.Text = "Выберите бронь."; return; }
        await Do(BookingsStatus, "Бронь отменена", () => _api.PostAsync($"/api/v1/bookings/{row.Id}/cancel"), RefreshBookingsAsync);
    }

    private void BkGuest_Changed(object sender, TextChangedEventArgs e) => Debounce(() => _ = SuggestGuestsAsync(BkGuestBox.Text, BkGuestSuggest));

    private void BkGuestSuggest_Selected(object sender, SelectionChangedEventArgs e)
    {
        if (BkGuestSuggest.SelectedItem is ListBoxItem li && li.Tag is string id)
        {
            _bkGuestId = id;
            BkGuestBox.TextChanged -= BkGuest_Changed;
            BkGuestBox.Text = li.Content?.ToString();
            BkGuestBox.TextChanged += BkGuest_Changed;
            BkGuestSuggest.Visibility = Visibility.Collapsed;
        }
    }

    private async void CreateBooking_Click(object sender, RoutedEventArgs e)
    {
        if (_bkGuestId is null || BkSeatBox.SelectedItem is not ComboBoxItem seat || BkTariffBox.SelectedItem is not ComboBoxItem tariff || BkDate.SelectedDate is not DateTime date)
        { BookingsStatus.Text = "Заполните гостя, ПК, тариф и дату."; return; }
        var hour = (int)((ComboBoxItem)BkHour.SelectedItem).Tag;
        var hours = (int)((ComboBoxItem)BkHours.SelectedItem).Tag;
        var starts = date.Date.AddHours(hour);
        await Do(BookingsStatus, "Бронь создана", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/bookings", new
        {
            userId = _bkGuestId, seatId = (string)seat.Tag, tariffId = (string)tariff.Tag,
            startsAt = starts.ToUniversalTime().ToString("o"), endsAt = starts.AddHours(hours).ToUniversalTime().ToString("o"),
        }), RefreshBookingsAsync);
    }

    // ---------- guests ----------

    private async Task RefreshGuestsAsync()
    {
        var q = GuestsSearch.Text.Trim();
        var res = await _api.GetAsync($"/api/v1/clubs/{_clubId}/guests{(q.Length > 0 ? $"?q={Uri.EscapeDataString(q)}" : "")}");
        GuestsGrid.ItemsSource = res.EnumerateArray().Select(g => new GuestRow(Str(g, "id"), Str(g, "displayName"), Str(g, "phone"),
            Money(g.GetProperty("balanceKopecks").GetInt32()), Money(g.GetProperty("bonusKopecks").GetInt32()),
            g.GetProperty("sessions").GetInt32(), string.Join(", ", g.GetProperty("cards").EnumerateArray().Select(c => c.GetString())))).ToList();
    }

    private void GuestsSearch_Changed(object sender, TextChangedEventArgs e) => Debounce(() => _ = SafeAsync(RefreshGuestsAsync));

    private void GuestsGrid_Selected(object sender, SelectionChangedEventArgs e)
    {
        if (GuestsGrid.SelectedItem is GuestRow g) { _selectedGuestId = g.Id; GuestTitle.Text = $"{g.Name} · {g.Balance}"; }
    }

    private async void Topup_Click(object sender, RoutedEventArgs e)
    {
        if (_selectedGuestId is null) { GuestsStatus.Text = "Выберите гостя."; return; }
        var kop = Kopecks(TopupBox.Text);
        await Do(GuestsStatus, $"Начислено {Money(kop)}", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/wallets/{_selectedGuestId}/topup", new { amountKopecks = kop, description = "Наличные на стойке" }), RefreshGuestsAsync);
    }

    private async void Bonus_Click(object sender, RoutedEventArgs e)
    {
        if (_selectedGuestId is null) { GuestsStatus.Text = "Выберите гостя."; return; }
        var kop = Kopecks(BonusBox.Text);
        await Do(GuestsStatus, $"Бонус {Money(kop)} начислен", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/wallets/{_selectedGuestId}/bonus", new { amountKopecks = kop }), RefreshGuestsAsync);
    }

    private async void IssueCard_Click(object sender, RoutedEventArgs e)
    {
        if (_selectedGuestId is null) { GuestsStatus.Text = "Выберите гостя."; return; }
        await Do(GuestsStatus, "Карта выдана", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/guest-cards", new { userId = _selectedGuestId, cardNumber = CardNumberBox.Text.Trim(), pin = CardPinBox.Text.Trim() }), RefreshGuestsAsync);
    }

    private async void Register_Click(object sender, RoutedEventArgs e)
    {
        await Do(GuestsStatus, "Гость зарегистрирован", async () =>
        {
            using var http = new System.Net.Http.HttpClient();
            var res = await http.PostAsync(_api.BaseUrl + "/api/v1/auth/register",
                new System.Net.Http.StringContent(JsonSerializer.Serialize(new { phone = RegPhone.Text.Trim(), displayName = RegName.Text.Trim(), password = RegPassword.Text }), System.Text.Encoding.UTF8, "application/json"));
            var body = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode) throw new ApiException(body, (int)res.StatusCode);
            GuestsSearch.Text = RegPhone.Text.Trim();
            return default;
        }, RefreshGuestsAsync);
    }

    // ---------- cash ----------

    private async Task RefreshCashAsync()
    {
        var p = await _api.GetAsync($"/api/v1/clubs/{_clubId}/products");
        _products = p.EnumerateArray().ToList();
        ProductsPanel.Children.Clear();
        foreach (var prod in _products)
        {
            var id = Str(prod, "id");
            var btn = new Button
            {
                Style = (Style)FindResource("Ghost"), Height = 76, Margin = new Thickness(0, 0, 8, 8), HorizontalContentAlignment = HorizontalAlignment.Left,
                Content = new StackPanel { Children = {
                    new TextBlock { Text = Str(prod, "name"), Foreground = (Brush)FindResource("Paper") },
                    new TextBlock { Text = Money(prod.GetProperty("priceKopecks").GetInt32()), Foreground = (Brush)FindResource("Gold"), FontSize = 12 },
                    new TextBlock { Text = _cart.TryGetValue(id, out var q) ? $"в чеке: {q}" : "", Foreground = (Brush)FindResource("Mute"), FontSize = 11 } } }
            };
            btn.Click += (_, _) => { _cart[id] = _cart.GetValueOrDefault(id) + 1; RenderCart(); _ = SafeAsync(RefreshCashProductsOnlyAsync); };
            ProductsPanel.Children.Add(btn);
        }
        var o = await _api.GetAsync($"/api/v1/clubs/{_clubId}/orders");
        OrdersGrid.ItemsSource = o.EnumerateArray().Select(x =>
        {
            var st = Str(x, "status");
            return new OrderRow(Str(x, "id"), DateTime.Parse(Str(x, "createdAt")).ToLocalTime().ToString("HH:mm"),
                string.Join(", ", x.GetProperty("items").EnumerateArray().Select(i => $"{Str(i.GetProperty("product"), "name")} ×{i.GetProperty("qty").GetInt32()}")),
                Str(x.GetProperty("user"), "displayName"), Money(x.GetProperty("totalKopecks").GetInt32()), OrderRu(st), st is not ("DELIVERED" or "CANCELLED"));
        }).ToList();
        if (_seats.Count == 0) { var map = await _api.GetAsync($"/api/v1/clubs/{_clubId}/seat-map"); _seats = map.EnumerateArray().ToList(); }
        var prev = (CashSeatBox.SelectedItem as ComboBoxItem)?.Tag as string;
        CashSeatBox.Items.Clear();
        CashSeatBox.Items.Add(new ComboBoxItem { Content = "Со стойки", Tag = "" });
        foreach (var s in _seats)
            CashSeatBox.Items.Add(new ComboBoxItem { Content = $"{Str(s, "label")}{(Str(s, "guestName") is { Length: > 0 } g ? $" · {g}" : "")}", Tag = Str(s, "id") });
        CashSeatBox.SelectedIndex = Math.Max(0, CashSeatBox.Items.Cast<ComboBoxItem>().ToList().FindIndex(i => (string)i.Tag == prev));
        RenderCart();
    }

    private Task RefreshCashProductsOnlyAsync()
    {
        foreach (var btn in ProductsPanel.Children.OfType<Button>())
        {
            if (btn.Content is StackPanel sp && sp.Children.Count == 3 && sp.Children[0] is TextBlock name)
            {
                var prod = _products.FirstOrDefault(p => Str(p, "name") == name.Text);
                if (prod.ValueKind == JsonValueKind.Object && sp.Children[2] is TextBlock q)
                    q.Text = _cart.TryGetValue(Str(prod, "id"), out var n) && n > 0 ? $"в чеке: {n}" : "";
            }
        }
        return Task.CompletedTask;
    }

    private void RenderCart()
    {
        var lines = new ObservableCollection<CartLine>();
        var total = 0;
        foreach (var (id, qty) in _cart.Where(kv => kv.Value > 0))
        {
            var prod = _products.FirstOrDefault(p => Str(p, "id") == id);
            if (prod.ValueKind != JsonValueKind.Object) continue;
            var price = prod.GetProperty("priceKopecks").GetInt32();
            total += price * qty;
            lines.Add(new CartLine(id, $"{Str(prod, "name")} × {qty}", Money(price * qty)));
        }
        CartList.ItemsSource = lines;
        CartTotal.Text = Money(total);
    }

    private void CashGuest_Changed(object sender, TextChangedEventArgs e) => Debounce(() => _ = SuggestGuestsAsync(CashGuestBox.Text, CashGuestSuggest));

    private void CashGuestSuggest_Selected(object sender, SelectionChangedEventArgs e)
    {
        if (CashGuestSuggest.SelectedItem is ListBoxItem li && li.Tag is string id)
        {
            _cashGuestId = id;
            CashGuestBox.TextChanged -= CashGuest_Changed;
            CashGuestBox.Text = li.Content?.ToString();
            CashGuestBox.TextChanged += CashGuest_Changed;
            CashGuestSuggest.Visibility = Visibility.Collapsed;
        }
    }

    private async void Sell_Click(object sender, RoutedEventArgs e)
    {
        if (_cart.Values.Sum() == 0) { CashStatus.Text = "Чек пуст."; return; }
        if (_cashGuestId is null) { CashStatus.Text = "Выберите гостя — списание идёт с его баланса."; return; }
        var seatId = (CashSeatBox.SelectedItem as ComboBoxItem)?.Tag as string;
        await Do(CashStatus, $"Продано на {CartTotal.Text}", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/orders", new
        {
            items = _cart.Where(kv => kv.Value > 0).Select(kv => new { productId = kv.Key, qty = kv.Value }).ToArray(),
            seatId = string.IsNullOrEmpty(seatId) ? null : seatId,
            userId = _cashGuestId,
        }), RefreshCashAsync);
        _cart.Clear();
        RenderCart();
    }

    private void ClearCart_Click(object sender, RoutedEventArgs e) { _cart.Clear(); RenderCart(); _ = SafeAsync(RefreshCashProductsOnlyAsync); }

    private async void Deliver_Click(object sender, RoutedEventArgs e)
    {
        if (OrdersGrid.SelectedItem is not OrderRow row || !row.Open) { CashStatus.Text = "Выберите открытый заказ."; return; }
        await Do(CashStatus, "Заказ выдан", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/orders/{row.Id}/status", new { status = "DELIVERED" }), RefreshCashAsync);
    }

    private async void AddProduct_Click(object sender, RoutedEventArgs e)
    {
        if (NewProductName.Text.Trim().Length == 0) { CashStatus.Text = "Введите название."; return; }
        var cat = (NewProductCat.SelectedItem as ComboBoxItem)?.Tag as string ?? "bar";
        await Do(CashStatus, "Товар добавлен", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/products", new { name = NewProductName.Text.Trim(), priceKopecks = Kopecks(NewProductPrice.Text), category = cat }), RefreshCashAsync);
        NewProductName.Clear(); NewProductPrice.Clear();
    }

    // ---------- shift ----------

    private async Task LoadShiftHeaderAsync()
    {
        try
        {
            var shifts = await _api.GetAsync($"/api/v1/clubs/{_clubId}/shifts");
            _openShift = shifts.EnumerateArray().FirstOrDefault(s => Str(s, "status") == "OPEN") is { ValueKind: JsonValueKind.Object } o ? o : null;
            ShiftLabel.Text = _openShift is JsonElement s ? $"Смена открыта с {DateTime.Parse(Str(s, "startedAt")).ToLocalTime():HH:mm}" : "Смена закрыта";
        }
        catch { /* ignore */ }
    }

    private async Task RefreshShiftAsync()
    {
        var ov = await _api.GetAsync($"/api/v1/clubs/{_clubId}/analytics/overview");
        StatOcc.Text = $"{ov.GetProperty("occupancyPct").GetInt32()}%";
        StatSessions.Text = ov.GetProperty("sessions").GetInt32().ToString();
        StatRevenue.Text = Money(ov.GetProperty("sessionRevenueKopecks").GetInt32());
        StatBar.Text = Money(ov.GetProperty("barRevenueKopecks").GetInt32());

        var occ = await _api.GetAsync($"/api/v1/clubs/{_clubId}/analytics/occupancy?hours=24");
        OccChart.Children.Clear();
        foreach (var b in occ.GetProperty("buckets").EnumerateArray())
        {
            var pct = b.GetProperty("occupancyPct").GetInt32();
            OccChart.Children.Add(new Border
            {
                Width = 22, Height = Math.Max(3, pct * 1.1), Margin = new Thickness(0, 0, 3, 0), VerticalAlignment = VerticalAlignment.Bottom,
                Background = (Brush)FindResource("Gold"), CornerRadius = new CornerRadius(2, 2, 0, 0), Opacity = 0.85,
                ToolTip = $"{DateTime.Parse(Str(b, "hour")).ToLocalTime():HH:00} · {pct}%",
            });
        }

        var rev = await _api.GetAsync($"/api/v1/clubs/{_clubId}/analytics/revenue?days=7");
        RevChart.Children.Clear();
        var days = rev.GetProperty("days").EnumerateArray().ToList();
        var max = Math.Max(1, days.Max(d => d.GetProperty("totalKopecks").GetInt32()));
        foreach (var d in days)
        {
            var row = new Grid { Margin = new Thickness(0, 3, 0, 3) };
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(70) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(100) });
            var date = new TextBlock { Text = DateTime.Parse(Str(d, "date")).ToString("dd.MM"), Foreground = (Brush)FindResource("Mute") };
            var bar = new StackPanel { Orientation = Orientation.Horizontal, Height = 18, Background = (Brush)FindResource("VelvetDeep") };
            var s = d.GetProperty("sessionKopecks").GetInt32(); var b = d.GetProperty("barKopecks").GetInt32();
            bar.SizeChanged += (_, _) =>
            {
                bar.Children.Clear();
                bar.Children.Add(new Border { Width = bar.ActualWidth * s / max, Background = (Brush)FindResource("Gold") });
                bar.Children.Add(new Border { Width = bar.ActualWidth * b / max, Background = (Brush)FindResource("Signal"), Opacity = 0.8 });
            };
            var total = new TextBlock { Text = Money(d.GetProperty("totalKopecks").GetInt32()), Foreground = (Brush)FindResource("Paper"), HorizontalAlignment = HorizontalAlignment.Right };
            Grid.SetColumn(bar, 1); Grid.SetColumn(total, 2);
            row.Children.Add(date); row.Children.Add(bar); row.Children.Add(total);
            RevChart.Children.Add(row);
        }

        var ret = await _api.GetAsync($"/api/v1/clubs/{_clubId}/analytics/retention");
        RetentionLabel.Text = $"Возвращаемость за 30 дней: {ret.GetProperty("returning").GetInt32()} из {ret.GetProperty("guests").GetInt32()} гостей были два и более раз ({ret.GetProperty("retentionPct").GetInt32()}%).";

        var shifts = await _api.GetAsync($"/api/v1/clubs/{_clubId}/shifts");
        ShiftsList.Items.Clear();
        _openShift = null;
        foreach (var s in shifts.EnumerateArray())
        {
            if (Str(s, "status") == "OPEN") _openShift = s;
            var ended = s.TryGetProperty("endedAt", out var e) && e.ValueKind == JsonValueKind.String ? $" — {DateTime.Parse(e.GetString()!).ToLocalTime():HH:mm}" : " — открыта";
            ShiftsList.Items.Add($"{DateTime.Parse(Str(s, "startedAt")).ToLocalTime():dd.MM HH:mm}{ended} · {Str(s.GetProperty("user"), "displayName")}");
        }
        ShiftTitle.Text = _openShift is JsonElement os ? $"Открыта {DateTime.Parse(Str(os, "startedAt")).ToLocalTime():HH:mm} · {Str(os.GetProperty("user"), "displayName")}" : "Смена закрыта";
        ShiftBtn.Content = _openShift is null ? "Открыть смену" : "Закрыть смену";
        ShiftBtn.Style = (Style)FindResource(_openShift is null ? "Primary" : "Danger");
        ShiftLabel.Text = _openShift is null ? "Смена закрыта" : $"Смена открыта с {DateTime.Parse(Str(_openShift.Value, "startedAt")).ToLocalTime():HH:mm}";

        var calls = await _api.GetAsync($"/api/v1/clubs/{_clubId}/calls");
        _calls = calls.EnumerateArray().ToList();
        CallsList.Items.Clear();
        foreach (var c in _calls)
            CallsList.Items.Add(new ListBoxItem { Content = $"{Str(c.GetProperty("seat"), "label")} · {Str(c.GetProperty("user"), "displayName")} · {(Str(c, "message") is { Length: > 0 } m ? m : "помощь")}", Tag = Str(c, "id") });
        if (_calls.Count == 0) CallsList.Items.Add(new ListBoxItem { Content = "Открытых вызовов нет", IsEnabled = false });
    }

    private async void Shift_Click(object sender, RoutedEventArgs e)
    {
        if (_openShift is JsonElement s)
            await Do(ShiftStatus, "Смена закрыта", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/shifts/{Str(s, "id")}/close"), RefreshShiftAsync);
        else
            await Do(ShiftStatus, "Смена открыта", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/shifts/open"), RefreshShiftAsync);
    }

    private async void ResolveCall_Click(object sender, RoutedEventArgs e)
    {
        if (CallsList.SelectedItem is not ListBoxItem li || li.Tag is not string id) { ShiftStatus.Text = "Выберите вызов."; return; }
        await Do(ShiftStatus, "Вызов закрыт", () => _api.PostAsync($"/api/v1/clubs/{_clubId}/calls/{id}/resolve"), RefreshShiftAsync);
    }

    // ---------- helpers ----------

    private void Debounce(Action a) { _debounced = a; _debounce.Stop(); _debounce.Start(); }

    private async Task Do(TextBlock status, string ok, Func<Task<JsonElement>> action, Func<Task> after)
    {
        try
        {
            status.Text = "";
            await action();
            status.Text = ok;
            LogLabel.Text = $"{DateTime.Now:HH:mm} {ok}";
            await after();
        }
        catch (Exception ex) { status.Text = ex.Message; }
    }

    private async Task SafeAsync(Func<Task> fn)
    {
        try { await fn(); }
        catch (Exception ex) { LogLabel.Text = ex.Message; }
    }

    private static string Str(JsonElement el, string name) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    private static string Remaining(JsonElement seat) =>
        seat.TryGetProperty("remainingSeconds", out var r) && r.ValueKind == JsonValueKind.Number
            ? TimeSpan.FromSeconds(r.GetInt32()).ToString(@"h\:mm")
            : "по балансу";

    private static string Money(int kopecks) => $"{kopecks / 100.0:0.00} Br";

    private static int Kopecks(string text) =>
        double.TryParse(text.Replace(',', '.'), NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? (int)Math.Round(v * 100) : 0;

    private static Brush Brush(string hex) => (Brush)new BrushConverter().ConvertFrom(hex)!;

    private static string StatusRu(string s) => s switch
    {
        "FREE" => "свободен", "OCCUPIED" => "занят", "RESERVED" => "бронь", "MAINTENANCE" => "сервис", "OFFLINE" => "офлайн", _ => s
    };

    private static string BookingRu(string s) => s switch
    {
        "PENDING" => "ожидает", "CONFIRMED" => "подтверждена", "CANCELLED" => "отменена", "COMPLETED" => "гость пришёл", "NO_SHOW" => "не пришёл", _ => s
    };

    private static string OrderRu(string s) => s switch
    {
        "PENDING" => "новый", "PAID" => "оплачен", "PREPARING" => "готовится", "READY" => "готов", "DELIVERED" => "выдан", "CANCELLED" => "отменён", _ => s
    };
}
