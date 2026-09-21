using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using Rudemir.GuestClient.Services;

namespace Rudemir.GuestClient;

public partial class MainWindow : Window
{
    private readonly ApiClient _api = new();
    private readonly RealtimeClient _rt = new();
    private readonly DispatcherTimer _heartbeat = new() { Interval = TimeSpan.FromSeconds(15) };
    private readonly DispatcherTimer _clock = new() { Interval = TimeSpan.FromSeconds(1) };
    private readonly DispatcherTimer _poll = new() { Interval = TimeSpan.FromSeconds(20) };
    private readonly ObservableCollection<string> _chat = new();
    private string _clubId = "";
    private string _seatId = "";
    private int? _remaining;
    private int _balance;
    private int _charged;
    private bool _sessionActive;
    private string? _pendingPaymentId;

    public MainWindow()
    {
        InitializeComponent();
        ChatList.ItemsSource = _chat;
        LoadConfig();
        _heartbeat.Tick += async (_, _) =>
        {
            if (string.IsNullOrEmpty(_seatId) || _api.AccessToken is null) return;
            try { await _api.HeartbeatAsync(_seatId, CurrentProcessName()); } catch { /* ignore */ }
        };
        _clock.Tick += (_, _) => Tick();
        _clock.Start();
        _poll.Tick += async (_, _) => await RefreshWalletAsync();
        PreviewKeyDown += OnPreviewKeyDown;
        _rt.EventReceived += OnRealtime;
#if !DEBUG
        Loaded += (_, _) => { if (SetupExpander is not null) SetupExpander.Visibility = Visibility.Collapsed; };
#endif
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
#if DEBUG
        if (e.Key == Key.Q && Keyboard.Modifiers == (ModifierKeys.Control | ModifierKeys.Shift))
        {
            Close();
            return;
        }
#endif
        var locked = LockOverlay.Visibility == Visibility.Visible;
        if (!locked) return;
        if (e.Key is Key.LWin or Key.RWin or Key.System or Key.LeftAlt or Key.RightAlt or Key.Tab or Key.Escape or Key.F4)
            e.Handled = true;
        if (Keyboard.Modifiers.HasFlag(ModifierKeys.Alt) && e.SystemKey is Key.Tab or Key.F4 or Key.Escape)
            e.Handled = true;
    }

    private void LoadConfig()
    {
        try
        {
            var env = Environment.GetEnvironmentVariable("RUDEMIR_API_BASE");
            if (!string.IsNullOrWhiteSpace(env)) _api.BaseUrl = env;
            foreach (var path in new[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Rudemir", "guest.json"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Rudemir", "agent.json"),
                Path.Combine(AppContext.BaseDirectory, "appsettings.json"),
            })
            {
                if (!File.Exists(path)) continue;
                using var doc = JsonDocument.Parse(File.ReadAllText(path));
                var root = doc.RootElement;
                if (root.TryGetProperty("ApiBase", out var api) && api.GetString() is { Length: > 0 } u)
                    _api.BaseUrl = u;
                if (root.TryGetProperty("ClubId", out var c) && c.GetString() is { Length: > 0 } club)
                    _clubId = club;
                if (root.TryGetProperty("SeatId", out var s) && s.GetString() is { Length: > 0 } seat)
                    _seatId = seat;
            }
            if (string.IsNullOrWhiteSpace(_api.BaseUrl)) _api.BaseUrl = "http://localhost:3000";
            SetupClubBox.Text = _clubId;
            SetupSeatBox.Text = _seatId;
        }
        catch { /* default */ }
    }

    private void SaveConfig()
    {
        var json = JsonSerializer.Serialize(new { ApiBase = _api.BaseUrl, ClubId = _clubId, SeatId = _seatId },
            new JsonSerializerOptions { WriteIndented = true });
        foreach (var path in new[]
        {
            Path.Combine(AppContext.BaseDirectory, "appsettings.json"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Rudemir", "guest.json"),
        })
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                File.WriteAllText(path, json);
            }
            catch { /* read-only dir */ }
        }
    }

    private void TabPhone_Click(object sender, RoutedEventArgs e)
    {
        PhonePane.Visibility = Visibility.Visible;
        CardPane.Visibility = Visibility.Collapsed;
        TabPhone.Style = (Style)FindResource("GoldBtn");
        TabCard.Style = (Style)FindResource("Ghost");
    }

    private void TabCard_Click(object sender, RoutedEventArgs e)
    {
        PhonePane.Visibility = Visibility.Collapsed;
        CardPane.Visibility = Visibility.Visible;
        TabCard.Style = (Style)FindResource("GoldBtn");
        TabPhone.Style = (Style)FindResource("Ghost");
    }

    private async void Login_Click(object sender, RoutedEventArgs e) =>
        await AuthAsync(() => _api.LoginAsync(PhoneBox.Text.Trim(), PasswordBox.Password));

    private async void CardLogin_Click(object sender, RoutedEventArgs e) =>
        await AuthAsync(() => _api.LoginCardAsync(CardBox.Text.Trim(), PinBox.Password));

    private async Task AuthAsync(Func<Task<JsonElement>> login)
    {
        try
        {
            LoginError.Text = "";
            _clubId = SetupClubBox.Text.Trim();
            _seatId = SetupSeatBox.Text.Trim();
            var tokens = await login();
            _api.SetToken(tokens.GetProperty("accessToken").GetString());
            var me = await _api.MeAsync();
            UserLabel.Text = me.GetProperty("displayName").GetString();
            if (me.TryGetProperty("wallet", out var w) && w.ValueKind == JsonValueKind.Object)
                SetBalance(w.GetProperty("balanceKopecks").GetInt32());

            if (string.IsNullOrWhiteSpace(_clubId))
            {
                var clubs = await _api.GetAsync("/api/v1/clubs");
                _clubId = clubs[0].GetProperty("id").GetString() ?? "";
            }
            var club = await _api.ClubAsync(_clubId);
            _clubId = club.GetProperty("id").GetString() ?? _clubId;
            ClubLabel.Text = club.GetProperty("name").GetString();
            SeatLabel.Text = ResolveSeatLabel(club);
            SaveConfig();

            await LoadAppsAsync();
            await LoadProductsAsync();
            await LoadActiveSessionAsync();
            await _rt.ConnectAsync(_api.BaseUrl, _api.AccessToken!);
            if (!string.IsNullOrEmpty(_seatId)) await _rt.JoinSeatAsync(_seatId);
            _heartbeat.Start();
            _poll.Start();
            PasswordBox.Clear();
            PinBox.Clear();
            LockOverlay.Visibility = Visibility.Collapsed;
        }
        catch (Exception ex)
        {
            LoginError.Text = ex.Message;
        }
    }

    private string ResolveSeatLabel(JsonElement club)
    {
        if (string.IsNullOrEmpty(_seatId) || !club.TryGetProperty("zones", out var zones)) return "";
        foreach (var z in zones.EnumerateArray())
            foreach (var s in z.GetProperty("seats").EnumerateArray())
                if (s.GetProperty("id").GetString() == _seatId)
                    return $"· {s.GetProperty("label").GetString()}";
        return "";
    }

    private async Task LoadActiveSessionAsync()
    {
        try
        {
            var sessions = await _api.MySessionsAsync();
            foreach (var s in sessions.EnumerateArray())
            {
                var status = s.GetProperty("status").GetString();
                if (status is "ACTIVE" or "PAUSED")
                {
                    ApplySession(s);
                    return;
                }
            }
            _sessionActive = false;
            TimerHint.Text = "Сессию запустит администратор или она стартует по брони";
        }
        catch { /* ignore */ }
    }

    private void ApplySession(JsonElement s)
    {
        _sessionActive = s.GetProperty("status").GetString() != "ENDED";
        if (s.TryGetProperty("remainingSeconds", out var rem) && rem.ValueKind == JsonValueKind.Number)
            _remaining = rem.GetInt32();
        else
            _remaining = null;
        if (s.TryGetProperty("totalChargedKopecks", out var ch) && ch.ValueKind == JsonValueKind.Number)
            _charged = ch.GetInt32();
        var mode = s.TryGetProperty("billingMode", out var bm) ? bm.GetString() : "WALLET";
        TariffLabel.Text = mode == "PREPAID" ? "Пакет минут" : "Списание с баланса поминутно";
        ChargedLabel.Text = $"Списано за сессию: {FormatMoney(_charged)}";
        TimerHint.Text = s.GetProperty("status").GetString() == "PAUSED" ? "пауза" : (_remaining is null ? "играете, пока есть баланс" : "осталось времени");
        Tick();
    }

    private async Task LoadAppsAsync()
    {
        AppsPanel.Children.Clear();
        var apps = await _api.AppsAsync(_clubId);
        foreach (var app in apps.EnumerateArray())
        {
            var name = app.GetProperty("name").GetString() ?? "App";
            var path = app.GetProperty("path").GetString() ?? "";
            var exists = File.Exists(path);
            var tile = new Button
            {
                Style = (Style)FindResource("Tile"),
                Margin = new Thickness(0, 0, 12, 12),
                Padding = new Thickness(16),
                HorizontalContentAlignment = HorizontalAlignment.Left,
                VerticalContentAlignment = VerticalAlignment.Bottom,
                Content = new StackPanel
                {
                    Children =
                    {
                        new TextBlock { Text = name[..1].ToUpperInvariant(), FontSize = 34, FontWeight = FontWeights.Bold, Foreground = (Brush)FindResource("Gold") },
                        new TextBlock { Text = name, FontSize = 15, Foreground = (Brush)FindResource("Paper"), Margin = new Thickness(0, 6, 0, 0) },
                        new TextBlock { Text = exists ? "запустить" : "не установлено", FontSize = 11, Foreground = (Brush)FindResource("Mute") }
                    }
                },
                Tag = path
            };
            tile.Click += (_, _) => Launch(path);
            AppsPanel.Children.Add(tile);
        }
        AppsHint.Text = apps.GetArrayLength() == 0 ? "клуб ещё не добавил приложения" : "нажмите, чтобы запустить";
    }

    private async Task LoadProductsAsync()
    {
        ProductBox.Items.Clear();
        var products = await _api.ProductsAsync(_clubId);
        foreach (var p in products.EnumerateArray())
        {
            ProductBox.Items.Add(new ComboBoxItem
            {
                Content = $"{p.GetProperty("name").GetString()} — {FormatMoney(p.GetProperty("priceKopecks").GetInt32())}",
                Tag = p.GetProperty("id").GetString()
            });
        }
        if (ProductBox.Items.Count > 0) ProductBox.SelectedIndex = 0;
    }

    private void Launch(string path)
    {
        if (!_sessionActive)
        {
            StatusLabel.Text = "Игры доступны после старта сессии.";
            return;
        }
        try
        {
            if (File.Exists(path)) Process.Start(new ProcessStartInfo(path) { UseShellExecute = true });
            else StatusLabel.Text = "Приложение не установлено на этом ПК.";
        }
        catch (Exception ex) { StatusLabel.Text = ex.Message; }
    }

    private async void CallAdmin_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            await _api.CallAdminAsync(_clubId, _seatId, "Нужна помощь");
            StatusLabel.Text = "Администратор вызван — подойдёт к вашему месту.";
        }
        catch (Exception ex) { StatusLabel.Text = ex.Message; }
    }

    private async void Order_Click(object sender, RoutedEventArgs e)
    {
        if (ProductBox.SelectedItem is not ComboBoxItem item || item.Tag is not string id) return;
        try
        {
            await _api.OrderAsync(_clubId, new { items = new[] { new { productId = id, qty = 1 } }, seatId = _seatId });
            StatusLabel.Text = "Заказ принят, принесут к месту.";
            await RefreshWalletAsync();
        }
        catch (Exception ex) { StatusLabel.Text = ex.Message; }
    }

    private async void Chat_Click(object sender, RoutedEventArgs e)
    {
        var text = ChatBox.Text.Trim();
        if (text.Length == 0) return;
        try
        {
            await _api.ChatAsync(_clubId, _seatId, text);
            _chat.Add($"Вы: {text}");
            ChatBox.Clear();
        }
        catch (Exception ex) { StatusLabel.Text = ex.Message; }
    }

    private async void Topup_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            if (_pendingPaymentId is not null)
            {
                await _api.SandboxCompleteAsync(_pendingPaymentId);
                _pendingPaymentId = null;
                TopupHint.Text = "Зачислено.";
                await RefreshWalletAsync();
                return;
            }
            if (!double.TryParse(TopupBox.Text.Replace(',', '.'), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var amount) || amount < 1)
            {
                TopupHint.Text = "Введите сумму от 1 Br.";
                return;
            }
            var checkout = await _api.CheckoutAsync((int)Math.Round(amount * 100), "bepaid");
            _pendingPaymentId = checkout.GetProperty("paymentId").GetString();
            TopupHint.Text = $"{checkout.GetProperty("instruction").GetString()} Нажмите «Оплатить» ещё раз после оплаты.";
        }
        catch (Exception ex) { TopupHint.Text = ex.Message; }
    }

    private async void Logout_Click(object sender, RoutedEventArgs e)
    {
        _heartbeat.Stop();
        _poll.Stop();
        await _rt.DisposeAsync();
        _api.SetToken(null);
        _sessionActive = false;
        _remaining = null;
        TimerLabel.Text = "--:--:--";
        LockTitle.Text = "ПК заблокирован";
        LockOverlay.Visibility = Visibility.Visible;
    }

    private async Task RefreshWalletAsync()
    {
        if (_api.AccessToken is null) return;
        try
        {
            var w = await _api.WalletAsync();
            SetBalance(w.GetProperty("balanceKopecks").GetInt32());
        }
        catch { /* ignore */ }
    }

    private void SetBalance(int kopecks)
    {
        _balance = kopecks;
        BalanceLabel.Text = FormatMoney(kopecks);
        BalanceLabel.Foreground = kopecks < 300 ? (Brush)FindResource("Busy") : (Brush)FindResource("Free");
    }

    private void OnRealtime(string name, SocketIOClient.SocketIOResponse resp)
    {
        Dispatcher.Invoke(() =>
        {
            try
            {
                var json = resp.GetValue<JsonElement>();
                switch (name)
                {
                    case "session.updated":
                        if (json.TryGetProperty("seatId", out var sid) && sid.GetString() != _seatId) return;
                        ApplySession(json);
                        if (json.GetProperty("status").GetString() == "ENDED")
                        {
                            _sessionActive = false;
                            LockTitle.Text = "Сессия завершена";
                            LockSubtitle.Text = "Спасибо за игру. Войдите снова, чтобы продолжить.";
                            LockOverlay.Visibility = Visibility.Visible;
                        }
                        else
                        {
                            LockOverlay.Visibility = Visibility.Collapsed;
                        }
                        break;
                    case "pc.command":
                        var cmd = json.GetProperty("command").GetString();
                        if (cmd is "LOCK" or "SHUTDOWN")
                        {
                            LockTitle.Text = cmd == "SHUTDOWN" ? "ПК выключается" : "ПК заблокирован администратором";
                            LockOverlay.Visibility = Visibility.Visible;
                        }
                        if (cmd == "UNLOCK") LockOverlay.Visibility = Visibility.Collapsed;
                        if (cmd == "REBOOT")
                        {
                            LockTitle.Text = "ПК перезагружается";
                            LockSubtitle.Text = "Агент выполняет перезагрузку.";
                            LockOverlay.Visibility = Visibility.Visible;
                        }
                        break;
                    case "chat.message":
                        var body = json.GetProperty("body").GetString();
                        var sender = json.TryGetProperty("sender", out var snd) && snd.ValueKind == JsonValueKind.Object
                            ? snd.GetProperty("displayName").GetString()
                            : "Администратор";
                        if (body is not null && !body.StartsWith("Вы:")) _chat.Add($"{sender}: {body}");
                        break;
                    case "notification":
                        StatusLabel.Text = $"{json.GetProperty("title").GetString()}: {json.GetProperty("body").GetString()}";
                        _ = RefreshWalletAsync();
                        break;
                }
            }
            catch { /* ignore malformed */ }
        });
    }

    private void Tick()
    {
        ClockLabel.Text = DateTime.Now.ToString("HH:mm · d MMMM", new System.Globalization.CultureInfo("ru-BY"));
        if (!_sessionActive)
        {
            return;
        }
        if (_remaining is int sec)
        {
            _remaining = Math.Max(0, sec - 1);
            TimerLabel.Text = TimeSpan.FromSeconds(_remaining.Value).ToString(@"hh\:mm\:ss");
            if (_remaining <= 300) TimerLabel.Foreground = (Brush)FindResource("Busy");
        }
        else
        {
            TimerLabel.Text = FormatMoney(_balance);
            TimerLabel.Foreground = _balance < 300 ? (Brush)FindResource("Busy") : (Brush)FindResource("Paper");
        }
    }

    private static string FormatMoney(int kopecks) => $"{kopecks / 100.0:0.00} Br";

    private static string? CurrentProcessName()
    {
        try
        {
            var procs = Process.GetProcesses();
            foreach (var p in procs)
            {
                if (p.MainWindowHandle != IntPtr.Zero && p.ProcessName is not ("explorer" or "Rudemir.GuestClient" or "Rudemir.Agent"))
                    return p.ProcessName;
            }
        }
        catch { /* ignore */ }
        return null;
    }
}
