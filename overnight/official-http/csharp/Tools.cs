using ModelContextProtocol.Server;
using System.ComponentModel;

[McpServerToolType]
public class BenchTools
{
    [McpServerTool(Name = "hello"), Description("Say hello")]
    public static string Hello(string name)
    {
        return $"Hello, {name}!";
    }

    [McpServerTool(Name = "add"), Description("Add two numbers")]
    public static string Add(double a, double b)
    {
        return $"{a + b}";
    }
}
