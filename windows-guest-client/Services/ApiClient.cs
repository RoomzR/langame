using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Rudemir.GuestClient.Services;

public class ApiClient
{
    private readonly HttpClient _http = new();
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public string BaseUrl { get; set; } = Environment.GetEnvironmentVariable("RUDEMIR_API_BASE") ?? "http://localhost:3000";
    public string? AccessToken { get; private set; }

    public void SetToken(string? token)
    {
        AccessToken = token;
        _http.DefaultRequestHeaders.Authorization = token is null
            ? null
            : new AuthenticationHeaderValue("Bearer", token);
    }

    public Task<JsonElement> LoginAsync(string phone, string password) =>
        PostAsync("/api/v1/auth/login", new { phone, password });

    public Task<JsonElement> LoginCardAsync(string cardNumber, string pin) =>
        PostAsync("/api/v1/auth/card", new { cardNumber, pin });

    public Task<JsonElement> MeAsync() => GetAsync("/api/v1/auth/me");

    public Task<JsonElement> WalletAsync() => GetAsync("/api/v1/me/wallet");

    public Task<JsonElement> MySessionsAsync() => GetAsync("/api/v1/me/sessions");

    public Task<JsonElement> ClubAsync(string idOrSlug) => GetAsync($"/api/v1/clubs/{idOrSlug}");

    public Task<JsonElement> AppsAsync(string clubId) => GetAsync($"/api/v1/clubs/{clubId}/apps");

    public Task<JsonElement> ProductsAsync(string clubId) => GetAsync($"/api/v1/clubs/{clubId}/products");

    public Task<JsonElement> OrderAsync(string clubId, object body) =>
        PostAsync($"/api/v1/clubs/{clubId}/orders", body);

    public Task<JsonElement> CallAdminAsync(string clubId, string seatId, string message) =>
        PostAsync($"/api/v1/clubs/{clubId}/seats/{seatId}/call", new { message });

    public Task<JsonElement> ChatAsync(string clubId, string seatId, string body) =>
        PostAsync($"/api/v1/clubs/{clubId}/chat", new { seatId, body });

    public Task<JsonElement> CheckoutAsync(int amountKopecks, string method) =>
        PostAsync("/api/v1/payments/checkout", new { amountKopecks, method });

    public Task<JsonElement> SandboxCompleteAsync(string paymentId) =>
        PostAsync($"/api/v1/payments/{paymentId}/sandbox-complete", new { });

    public Task HeartbeatAsync(string seatId, string? processName) =>
        PostAsync($"/api/v1/seats/{seatId}/heartbeat", new { currentProcess = processName });

    public async Task<JsonElement> GetAsync(string path)
    {
        var res = await _http.GetAsync(BaseUrl.TrimEnd('/') + path);
        var json = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode) throw new ApiException(json, (int)res.StatusCode);
        return JsonSerializer.Deserialize<JsonElement>(json, JsonOpts);
    }

    public async Task<JsonElement> PostAsync(string path, object body)
    {
        var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var res = await _http.PostAsync(BaseUrl.TrimEnd('/') + path, content);
        var json = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode) throw new ApiException(json, (int)res.StatusCode);
        if (string.IsNullOrWhiteSpace(json)) return default;
        return JsonSerializer.Deserialize<JsonElement>(json, JsonOpts);
    }
}

public sealed class ApiException : Exception
{
    public int Status { get; }
    public string Code { get; }

    public ApiException(string body, int status) : base(Humanize(body, status))
    {
        Status = status;
        Code = ExtractCode(body);
    }

    private static string ExtractCode(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("code", out var c)) return c.GetString() ?? "";
            if (doc.RootElement.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String) return m.GetString() ?? "";
        }
        catch { /* not json */ }
        return "";
    }

    private static string Humanize(string body, int status)
    {
        var code = ExtractCode(body);
        return code switch
        {
            "INVALID_CREDENTIALS" => "Неверный телефон или пароль.",
            "INVALID_CARD" => "Карта не найдена или неверный PIN.",
            "INSUFFICIENT_FUNDS" => "Не хватает средств на балансе. Пополните счёт.",
            "UNAUTHORIZED" => "Сессия входа истекла — войдите снова.",
            "EMPTY_ORDER" => "Выберите товар.",
            "" => $"Сервис недоступен ({status}).",
            _ => code,
        };
    }
}
