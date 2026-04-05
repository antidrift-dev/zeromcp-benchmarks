using ModelContextProtocol.Server;
using System.ComponentModel;
using System.Text.Json;

[McpServerToolType]
public sealed class BenchTools
{
    [McpServerTool(Name = "hello"), Description("Say hello to someone")]
    public static string Hello(
        [Description("Name to greet")] string name)
    {
        return $"Hello, {name}!";
    }

    [McpServerTool(Name = "add"), Description("Add two numbers together")]
    public static string Add(
        [Description("First number")] double a,
        [Description("Second number")] double b)
    {
        return JsonSerializer.Serialize(new { sum = a + b });
    }
}
