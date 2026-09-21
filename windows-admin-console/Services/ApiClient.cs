using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Rudemir.AdminConsole.Services;

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

    public Task<JsonElement> PostAsync(string path, object? body = null) => SendAsync(HttpMethod.Post, path, body ?? new { });
    public Task<JsonElement> PatchAsync(string path, object body) => SendAsync(HttpMethod.Patch, path, body);
    public Task<JsonElement> GetAsync(string path) => SendAsync(HttpMethod.Get, path, null);

    private async Task<JsonElement> SendAsync(HttpMethod method, string path, object? body)
    {
        using var req = new HttpRequestMessage(method, BaseUrl.TrimEnd('/') + path);
        if (body is not null)
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var res = await _http.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode) throw new ApiException(json, (int)res.StatusCode);
        if (string.IsNullOrWhiteSpace(json)) return default;
        return JsonSerializer.Deserialize<JsonElement>(json, JsonOpts);
    }
}

public sealed class ApiException : Exception
{
    public ApiException(string body, int status) : base(Humanize(body, status)) { }

    private static string Humanize(string body, int status)
    {
        var code = "";
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("code", out var c)) code = c.GetString() ?? "";
            else if (doc.RootElement.TryGetProperty("message", out var m))
                code = m.ValueKind == JsonValueKind.Array ? string.Join(", ", m.EnumerateArray().Select(x => x.GetString())) : m.GetString() ?? "";
        }
        catch { /* not json */ }
        return code switch
        {
            "INVALID_CREDENTIALS" => "Неверный телефон или пароль.",
            "SEAT_BUSY" => "На этом ПК уже идёт сессия.",
            "INSUFFICIENT_FUNDS" => "У гостя не хватает средств.",
            "WALLET_NOT_FOUND" => "У гостя нет кошелька.",
            "SEAT_UNAVAILABLE" => "ПК недоступен (сервис или офлайн).",
            "SESSION_INACTIVE" => "Сессия уже завершена.",
            "SLOT_TAKEN" => "Слот на это время занят.",
            "FORBIDDEN" => "Недостаточно прав.",
            "UNAUTHORIZED" => "Войдите заново.",
            "EMPTY_ORDER" => "Чек пуст.",
            "PHONE_TAKEN" => "Телефон уже зарегистрирован.",
            "CARD_TAKEN" => "Такая карта уже выдана.",
            "" => $"Сервис недоступен ({status}).",
            _ => code,
        };
    }
}
