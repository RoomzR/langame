using System.IO.Compression;
using System.Text.Json;

namespace Rudemir.Agent;

public sealed class AgentWorker : BackgroundService
{
    readonly AgentApi _api = new();
    DateTime _lastUpdateCheck = DateTime.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        AgentLog.Info("Rudemir.Agent started");
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Tick(stoppingToken);
            }
            catch (Exception ex)
            {
                AgentLog.Error(ex.Message);
            }
            try { await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    async Task Tick(CancellationToken ct)
    {
        var cfg = AgentConfig.Load();
        if (string.IsNullOrWhiteSpace(cfg.AgentToken) || string.IsNullOrWhiteSpace(cfg.SeatId))
        {
            AgentLog.Warn("not paired — run: Rudemir.Agent.exe pair --api --club --seat --code");
            return;
        }
        _api.Configure(cfg);
        var proc = CurrentProcess();
        await _api.HeartbeatAsync(proc, cfg.Version, Environment.MachineName);
        CommandRouter.EnsureGuestRunning();

        var cmds = await _api.CommandsAsync();
        if (cmds.ValueKind == JsonValueKind.Array)
        {
            foreach (var row in cmds.EnumerateArray())
            {
                var id = row.GetProperty("id").GetString() ?? "";
                var command = row.GetProperty("command").GetString() ?? "";
                var payload = row.TryGetProperty("payload", out var p) ? p : default;
                try
                {
                    var result = CommandRouter.Execute(command, payload);
                    await _api.AckAsync(id, "DONE", result);
                    AgentLog.Info($"{command} {id} OK {result}");
                }
                catch (Exception ex)
                {
                    await _api.AckAsync(id, "FAILED", ex.Message);
                    AgentLog.Error($"{command} {id}: {ex.Message}");
                }
            }
        }

        if (DateTime.UtcNow - _lastUpdateCheck > TimeSpan.FromHours(1))
        {
            _lastUpdateCheck = DateTime.UtcNow;
            await CheckUpdate(cfg);
        }
    }

    async Task CheckUpdate(AgentConfig cfg)
    {
        try
        {
            var info = await _api.UpdateAsync(string.IsNullOrWhiteSpace(cfg.Channel) ? "stable" : cfg.Channel);
            var version = info.TryGetProperty("version", out var v) ? v.GetString() ?? "" : "";
            var url = info.TryGetProperty("url", out var u) ? u.GetString() ?? "" : "";
            var sha = info.TryGetProperty("sha256", out var s) ? s.GetString() ?? "" : "";
            if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(version)) return;
            if (!Newer(version, cfg.Version)) return;
            var dir = Path.Combine(AgentConfig.DataDir, "updates");
            Directory.CreateDirectory(dir);
            var zip = Path.Combine(dir, "agent.zip");
            await _api.DownloadAsync(url, zip);
            if (!string.IsNullOrWhiteSpace(sha))
            {
                using var sha256 = System.Security.Cryptography.SHA256.Create();
                await using var fs = File.OpenRead(zip);
                var hash = Convert.ToHexString(sha256.ComputeHash(fs)).ToLowerInvariant();
                if (!hash.Equals(sha, StringComparison.OrdinalIgnoreCase))
                {
                    AgentLog.Error("update sha256 mismatch");
                    return;
                }
            }
            var extract = Path.Combine(dir, "extract");
            if (Directory.Exists(extract)) Directory.Delete(extract, true);
            System.IO.Compression.ZipFile.ExtractToDirectory(zip, extract);
            var dest = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
            var bat = Path.Combine(dir, "apply.cmd");
            File.WriteAllText(bat, $"""
                @echo off
                timeout /t 5 /nobreak >nul
                net stop RudemirAgent
                xcopy /E /Y /I "{extract}\*" "{dest}\"
                net start RudemirAgent
                """);
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("cmd.exe", $"/c \"{bat}\"") { UseShellExecute = true });
            AgentLog.Info($"update {version} scheduled");
        }
        catch (Exception ex)
        {
            AgentLog.Warn($"update: {ex.Message}");
        }
    }

    static bool Newer(string remote, string local)
    {
        try { return Version.Parse(Normalize(remote)) > Version.Parse(Normalize(local)); }
        catch { return !string.Equals(remote, local, StringComparison.OrdinalIgnoreCase); }
    }

    static string Normalize(string v) => v.Count(c => c == '.') >= 3 ? v : v + ".0";

    static string? CurrentProcess()
    {
        try
        {
            foreach (var p in System.Diagnostics.Process.GetProcesses())
            {
                if (p.MainWindowHandle != IntPtr.Zero && p.ProcessName is not ("explorer" or "Rudemir.Agent" or "Rudemir.GuestClient"))
                    return p.ProcessName;
            }
        }
        catch { /* ignore */ }
        return null;
    }
}
