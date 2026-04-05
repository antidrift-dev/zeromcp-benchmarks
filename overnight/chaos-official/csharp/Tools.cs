using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json;
using System.ComponentModel;
using ModelContextProtocol.Server;

[McpServerToolType]
public sealed class ChaosTools
{
    private static readonly List<byte[]> Leaks = new();

    [McpServerTool(Name = "hello"), Description("Say hello")]
    public static string Hello(string name)
    {
        return $"Hello, {name}!";
    }

    [McpServerTool(Name = "throw_error"), Description("Tool that throws")]
    public static string ThrowError()
    {
        throw new InvalidOperationException("Intentional chaos: unhandled exception");
    }

    [McpServerTool(Name = "hang"), Description("Tool that hangs forever")]
    public static async Task<string> Hang()
    {
        await Task.Delay(TimeSpan.FromDays(1));
        return "unreachable";
    }

    [McpServerTool(Name = "slow"), Description("Tool that takes 3 seconds")]
    public static async Task<string> Slow()
    {
        await Task.Delay(TimeSpan.FromSeconds(3));
        return JsonSerializer.Serialize(new { status = "ok", delay_ms = 3000 });
    }

    [McpServerTool(Name = "leak_memory"), Description("Tool that leaks memory")]
    public static string LeakMemory()
    {
        lock (Leaks)
        {
            Leaks.Add(new byte[1024 * 1024]);
            return JsonSerializer.Serialize(new { leaked_buffers = Leaks.Count, total_mb = Leaks.Count });
        }
    }

    [McpServerTool(Name = "stdout_corrupt"), Description("Tool that writes to stdout")]
    public static string StdoutCorrupt()
    {
        Console.WriteLine("CORRUPTED OUTPUT");
        Console.Out.Flush();
        return JsonSerializer.Serialize(new { status = "ok" });
    }
}
