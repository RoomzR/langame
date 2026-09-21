namespace Rudemir.Agent;

public sealed class AgentConfig
{
    public string ApiBase { get; set; } = "http://localhost:3000";
    public string ClubId { get; set; } = "";
    public string SeatId { get; set; } = "";
    public string AgentToken { get; set; } = "";
    public string Channel { get; set; } = "stable";
    public string Version { get; set; } = "1.0.0";

    public static string DataDir => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Rudemir");
    public static string LogDir => Path.Combine(DataDir, "logs");
    public static string SessionDir => Path.Combine(DataDir, "session");
    public static string ConfigPath => Path.Combine(DataDir, "agent.json");
    public static string GuestConfigPath => Path.Combine(DataDir, "guest.json");

    public static AgentConfig Load()
    {
        Directory.CreateDirectory(DataDir);
        Directory.CreateDirectory(LogDir);
        Directory.CreateDirectory(SessionDir);
        if (!File.Exists(ConfigPath)) return new AgentConfig();
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<AgentConfig>(File.ReadAllText(ConfigPath)) ?? new AgentConfig();
        }
        catch
        {
            return new AgentConfig();
        }
    }

    public void Save()
    {
        Directory.CreateDirectory(DataDir);
        var json = System.Text.Json.JsonSerializer.Serialize(this, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(ConfigPath, json);
        WriteGuestConfig();
    }

    public void WriteGuestConfig()
    {
        var guest = System.Text.Json.JsonSerializer.Serialize(new { ApiBase, ClubId, SeatId }, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(GuestConfigPath, guest);
        foreach (var path in GuestAppSettingsCandidates())
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                File.WriteAllText(path, guest);
            }
            catch { /* locked or missing */ }
        }
    }

    public static IEnumerable<string> GuestAppSettingsCandidates()
    {
        yield return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Rudemir", "Guest", "appsettings.json");
        var local = Path.Combine(AppContext.BaseDirectory, "..", "Guest", "appsettings.json");
        yield return Path.GetFullPath(local);
    }

    public static string? FindGuestExe()
    {
        var candidates = new[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Rudemir", "Guest", "Rudemir.GuestClient.exe"),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "Guest", "Rudemir.GuestClient.exe")),
            Path.Combine(AppContext.BaseDirectory, "Rudemir.GuestClient.exe"),
        };
        return candidates.FirstOrDefault(File.Exists);
    }
}
