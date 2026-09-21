using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Rudemir.Agent;

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        if (args.Length > 0 && string.Equals(args[0], "pair", StringComparison.OrdinalIgnoreCase))
            return await PairCommand.Run(args.Skip(1).ToArray());

        var builder = Host.CreateApplicationBuilder(args);
        builder.Services.AddWindowsService(o => o.ServiceName = "RudemirAgent");
        builder.Services.AddHostedService<AgentWorker>();
        var host = builder.Build();
        await host.RunAsync();
        return 0;
    }
}
