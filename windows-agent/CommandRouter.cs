using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

namespace Rudemir.Agent;

public static class CommandRouter
{
    public static string Execute(string command, JsonElement payload)
    {
        return command.ToUpperInvariant() switch
        {
            "LOCK" => Lock(true),
            "UNLOCK" => Lock(false),
            "REBOOT" => Power("r"),
            "SHUTDOWN" => Power("s"),
            "SYNC_HOSTS" => SyncHosts(Str(payload, "hostsExtra")),
            "STARTUP_CLEAN" => StartupClean(Str(payload, "startupClean")),
            "APPLY_POLICY" => ApplyPolicy(payload),
            "ENERGY" => Energy(payload),
            _ => throw new InvalidOperationException($"unknown command {command}"),
        };
    }

    static string Lock(bool on)
    {
        Directory.CreateDirectory(AgentConfig.DataDir);
        File.WriteAllText(Path.Combine(AgentConfig.DataDir, "lock.flag"), on ? "1" : "0");
        EnsureGuestRunning();
        return on ? "locked" : "unlocked";
    }

    static string Power(string flag)
    {
        Run("shutdown.exe", $"/{flag} /t 8 /f /c \"RUDEMIR\"");
        return $"shutdown /{flag}";
    }

    static string SyncHosts(string extra)
    {
        var hosts = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"drivers\etc\hosts");
        var bak = Path.Combine(AgentConfig.DataDir, "hosts.bak");
        if (!File.Exists(bak) && File.Exists(hosts)) File.Copy(hosts, bak, overwrite: false);
        var existing = File.Exists(hosts) ? File.ReadAllText(hosts) : "";
        var block = new StringBuilder();
        block.AppendLine();
        block.AppendLine("# RUDEMIR hostsExtra");
        foreach (var raw in extra.Split(new[] { '\r', '\n', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (existing.Contains(raw, StringComparison.OrdinalIgnoreCase)) continue;
            block.AppendLine(raw);
        }
        if (block.Length > 24) File.AppendAllText(hosts, block.ToString());
        return "hosts synced";
    }

    static string StartupClean(string paths)
    {
        var n = 0;
        foreach (var raw in paths.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            try
            {
                if (Directory.Exists(raw))
                {
                    Directory.Delete(raw, recursive: true);
                    n++;
                }
                else if (File.Exists(raw))
                {
                    File.Delete(raw);
                    n++;
                }
            }
            catch (Exception ex)
            {
                AgentLog.Warn($"clean {raw}: {ex.Message}");
            }
        }
        return $"cleaned {n}";
    }

    static string ApplyPolicy(JsonElement payload)
    {
        var freezeOn = Bool(payload, "freezeOn");
        Directory.CreateDirectory(AgentConfig.SessionDir);
        if (freezeOn)
        {
            try
            {
                foreach (var e in Directory.EnumerateFileSystemEntries(AgentConfig.SessionDir))
                {
                    try
                    {
                        if (Directory.Exists(e)) Directory.Delete(e, true);
                        else File.Delete(e);
                    }
                    catch { /* in use */ }
                }
            }
            catch (Exception ex) { AgentLog.Warn($"session wipe: {ex.Message}"); }

            try
            {
                using var key = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Policies\Microsoft\Windows\Installer");
                key?.SetValue("DisableMSI", 1, RegistryValueKind.DWord);
            }
            catch (Exception ex) { AgentLog.Warn($"msi policy: {ex.Message}"); }
        }
        else
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Policies\Microsoft\Windows\Installer", writable: true);
                key?.DeleteValue("DisableMSI", throwOnMissingValue: false);
            }
            catch { /* ignore */ }
        }

        InvokeFreezeVendors(freezeOn);
        if (!string.IsNullOrWhiteSpace(Str(payload, "startupClean")))
            StartupClean(Str(payload, "startupClean"));
        return freezeOn ? "policy freeze-on" : "policy freeze-off";
    }

    static void InvokeFreezeVendors(bool freezeOn)
    {
        var sd = new[]
        {
            @"C:\Windows\System32\SDRestore.exe",
            @"C:\Program Files\Shadow Defender\SDRestore.exe",
            @"C:\Program Files (x86)\Shadow Defender\SDRestore.exe",
        }.FirstOrDefault(File.Exists);
        if (sd is not null && freezeOn)
        {
            Run(sd, "");
            AgentLog.Info($"Shadow Defender CLI: {sd}");
        }

        var df = new[]
        {
            @"C:\Program Files\Faronics\Deep Freeze\Install C-0\DFC.exe",
            @"C:\Windows\System32\DFC.exe",
        }.FirstOrDefault(File.Exists);
        if (df is not null && freezeOn)
        {
            AgentLog.Info($"Deep Freeze CLI found: {df} (password not supplied — skip boot freeze)");
        }
    }

    static string Energy(JsonElement payload)
    {
        if (Bool(payload, "ignoreMonSleep")) Run("powercfg.exe", "-change -monitor-timeout-ac 0");
        if (Bool(payload, "ignorePcSleep"))
        {
            Run("powercfg.exe", "-change -standby-timeout-ac 0");
            Run("powercfg.exe", "-change -hibernate-timeout-ac 0");
        }
        return "energy applied";
    }

    public static void EnsureGuestRunning()
    {
        var exe = AgentConfig.FindGuestExe();
        if (exe is null) return;
        var name = Path.GetFileNameWithoutExtension(exe);
        if (Process.GetProcessesByName(name).Length > 0) return;
        try
        {
            Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true, WorkingDirectory = Path.GetDirectoryName(exe) });
            AgentLog.Info($"started guest {exe}");
        }
        catch (Exception ex)
        {
            AgentLog.Warn($"guest start: {ex.Message}");
        }
    }

    static void Run(string file, string args)
    {
        using var p = Process.Start(new ProcessStartInfo(file, args)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        });
        p?.WaitForExit(30_000);
    }

    static string Str(JsonElement el, string name) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? ""
            : el.ValueKind == JsonValueKind.Object && el.TryGetProperty(name, out var n) && n.ValueKind is JsonValueKind.True or JsonValueKind.False or JsonValueKind.Number
                ? n.ToString()
                : "";

    static bool Bool(JsonElement el, string name)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(name, out var v)) return false;
        return v.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String => v.GetString() is "1" or "true" or "True",
            JsonValueKind.Number => v.TryGetInt32(out var n) && n != 0,
            _ => false,
        };
    }
}
