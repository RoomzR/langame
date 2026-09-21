using System.Net;
using System.Text.Json;

namespace Rudemir.Agent;

public static class PairCommand
{
    public static async Task<int> Run(string[] args)
    {
        var api = Arg(args, "--api") ?? "http://localhost:3000";
        var club = Arg(args, "--club") ?? "";
        var seat = Arg(args, "--seat") ?? "";
        var code = Arg(args, "--code") ?? "";
        if (string.IsNullOrWhiteSpace(club))
        {
            Console.Write("ClubId: ");
            club = Console.ReadLine()?.Trim() ?? "";
        }
        if (string.IsNullOrWhiteSpace(seat))
        {
            Console.Write("SeatId: ");
            seat = Console.ReadLine()?.Trim() ?? "";
        }
        if (string.IsNullOrWhiteSpace(code))
        {
            Console.Write("Код привязки: ");
            code = Console.ReadLine()?.Trim() ?? "";
        }
        if (club.Length == 0 || seat.Length == 0 || code.Length == 0)
        {
            Console.Error.WriteLine("usage: Rudemir.Agent.exe pair --api http://host:3000 --club <id> --seat <id> --code <CODE>");
            return 1;
        }

        var client = new AgentApi();
        var cfg = new AgentConfig { ApiBase = api, ClubId = club, SeatId = seat, Version = "1.0.0", Channel = "stable" };
        client.Configure(cfg);
        try
        {
            var res = await client.EnrollAsync(club, seat, code.Trim().ToUpperInvariant(), Dns.GetHostName(), cfg.Version);
            cfg.AgentToken = res.GetProperty("agentToken").GetString() ?? "";
            cfg.ClubId = res.TryGetProperty("clubId", out var c) ? c.GetString() ?? club : club;
            cfg.SeatId = res.TryGetProperty("seatId", out var s) ? s.GetString() ?? seat : seat;
            cfg.Save();
            Console.WriteLine($"OK: место привязано. Конфиг {AgentConfig.ConfigPath}");
            Console.WriteLine("Запустите службу: sc.exe start RudemirAgent");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 2;
        }
    }

    static string? Arg(string[] args, string name)
    {
        for (var i = 0; i < args.Length - 1; i++)
            if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase)) return args[i + 1];
        return null;
    }
}
