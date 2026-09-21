namespace Rudemir.Agent;

public static class AgentLog
{
    static readonly object Gate = new();

    public static void Info(string message) => Write("INF", message);
    public static void Warn(string message) => Write("WRN", message);
    public static void Error(string message) => Write("ERR", message);

    static void Write(string level, string message)
    {
        try
        {
            Directory.CreateDirectory(AgentConfig.LogDir);
            var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {level} {message}{Environment.NewLine}";
            var path = Path.Combine(AgentConfig.LogDir, $"agent-{DateTime.Now:yyyyMMdd}.log");
            lock (Gate)
            {
                File.AppendAllText(path, line);
                Rotate();
            }
        }
        catch { /* logging must never throw */ }
    }

    static void Rotate()
    {
        foreach (var file in Directory.GetFiles(AgentConfig.LogDir, "agent-*.log"))
        {
            try
            {
                if (File.GetLastWriteTime(file) < DateTime.Now.AddDays(-14)) File.Delete(file);
            }
            catch { /* ignore */ }
        }
    }
}
