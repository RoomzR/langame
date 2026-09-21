using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Rudemir.Agent;

public sealed class AgentApi
{
    static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };
    readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(20) };

    public void Configure(AgentConfig cfg)
    {
        _http.BaseAddress = new Uri(cfg.ApiBase.TrimEnd('/') + "/");
        _http.DefaultRequestHeaders.Authorization = string.IsNullOrWhiteSpace(cfg.AgentToken)
            ? null
            : new AuthenticationHeaderValue("Bearer", cfg.AgentToken);
    }

    public async Task<JsonElement> EnrollAsync(string clubId, string seatId, string code, string hostname, string version)
    {
        return await PostAsync("api/v1/agent/enroll", new { clubId, seatId, code, hostname, version }, authed: false);
    }

    public Task<JsonElement> HeartbeatAsync(string? process, string version, string hostname) =>
        PostAsync("api/v1/agent/heartbeat", new { currentProcess = process, version, hostname });

    public async Task<JsonElement> CommandsAsync()
    {
        using var res = await _http.GetAsync("api/v1/agent/commands");
        var json = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode) throw new HttpRequestException($"commands {res.StatusCode}: {json}");
        if (string.IsNullOrWhiteSpace(json)) return default;
        return JsonSerializer.Deserialize<JsonElement>(json, Json);
    }

    public Task<JsonElement> AckAsync(string id, string status, string result) =>
        PostAsync($"api/v1/agent/commands/{id}/ack", new { status, result });

    public async Task<JsonElement> UpdateAsync(string channel)
    {
        using var res = await _http.GetAsync($"api/v1/agent/update?channel={Uri.EscapeDataString(channel)}");
        var json = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode) throw new HttpRequestException($"update {res.StatusCode}");
        return JsonSerializer.Deserialize<JsonElement>(json, Json);
    }

    public async Task DownloadAsync(string url, string dest)
    {
        using var res = await _http.GetAsync(url);
        res.EnsureSuccessStatusCode();
        await using var fs = File.Create(dest);
        await res.Content.CopyToAsync(fs);
    }

    async Task<JsonElement> PostAsync(string path, object body, bool authed = true)
    {
        if (authed && _http.DefaultRequestHeaders.Authorization is null)
            throw new InvalidOperationException("not enrolled");
        var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        using var res = await _http.PostAsync(path, content);
        var json = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode) throw new HttpRequestException($"{path} {res.StatusCode}: {json}");
        if (string.IsNullOrWhiteSpace(json)) return default;
        return JsonSerializer.Deserialize<JsonElement>(json, Json);
    }
}
