using SocketIOClient;

namespace Rudemir.GuestClient.Services;

public sealed class RealtimeClient : IDisposable
{
    private SocketIOClient.SocketIO? _socket;

    public event Action<string, SocketIOResponse>? EventReceived;

    public async Task ConnectAsync(string baseUrl, string token)
    {
        await DisposeAsync();
        _socket = new SocketIOClient.SocketIO(baseUrl, new SocketIOOptions
        {
            Auth = new Dictionary<string, string> { ["token"] = token },
            Transport = SocketIOClient.Transport.TransportProtocol.WebSocket
        });
        _socket.OnAny((name, resp) => EventReceived?.Invoke(name, resp));
        await _socket.ConnectAsync();
    }

    public Task JoinSeatAsync(string seatId) =>
        _socket?.EmitAsync("join_seat", new { seatId }) ?? Task.CompletedTask;

    public async Task DisposeAsync()
    {
        if (_socket is null) return;
        try { await _socket.DisconnectAsync(); } catch { /* ignore */ }
        _socket.Dispose();
        _socket = null;
    }

    public void Dispose() => DisposeAsync().GetAwaiter().GetResult();
}
