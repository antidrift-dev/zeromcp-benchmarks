using System.Text.Json;
using ZeroMcp;

/**
 * ZeroMCP over ASP.NET Minimal API -- HTTP benchmark server.
 */

var server = new ZeroMcpServer();

server.Tool("hello", "Say hello",
    input: new Dictionary<string, InputField>
    {
        ["name"] = new InputField(SimpleType.String, "Name to greet")
    },
    execute: (args, ctx) =>
    {
        var name = args.TryGetValue("name", out var n) ? n.GetString() ?? "world" : "world";
        return Task.FromResult<object>($"Hello, {name}!");
    });

server.Tool("add", "Add two numbers",
    input: new Dictionary<string, InputField>
    {
        ["a"] = new InputField(SimpleType.Number, "First number"),
        ["b"] = new InputField(SimpleType.Number, "Second number")
    },
    execute: (args, ctx) =>
    {
        var a = args.TryGetValue("a", out var av) ? av.GetDouble() : 0.0;
        var b = args.TryGetValue("b", out var bv) ? bv.GetDouble() : 0.0;
        return Task.FromResult<object>(a + b);
    });

server.Resource("data", "resource:///data.json", "Static data", "application/json",
    () => Task.FromResult("{\"key\":\"value\",\"count\":42}"));

server.Resource("dynamic", "resource:///dynamic", "Dynamic", "application/json",
    () => Task.FromResult("{\"dynamic\":true}"));

server.Prompt("greet", "Greeting",
    arguments: new List<PromptArgument>
    {
        new PromptArgument { Name = "name", Description = "Name to greet", Required = true },
        new PromptArgument { Name = "tone", Description = "Tone of greeting", Required = false }
    },
    renderFunc: args =>
    {
        var name = args.TryGetValue("name", out var n) ? n : "world";
        var tone = args.TryGetValue("tone", out var t) ? t : "friendly";
        return Task.FromResult(new List<Dictionary<string, object>>
        {
            new Dictionary<string, object>
            {
                ["role"] = "user",
                ["content"] = new Dictionary<string, string>
                {
                    ["type"] = "text",
                    ["text"] = $"Give a {tone} greeting to {name}."
                }
            }
        });
    });

var port = Environment.GetEnvironmentVariable("PORT") ?? "3000";
var builder = WebApplication.CreateBuilder(args);
builder.Logging.SetMinimumLevel(LogLevel.Warning);
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
var app = builder.Build();

app.MapGet("/health", () => Results.Json(new { status = "ok" }));

app.MapPost("/mcp", async (HttpContext ctx) =>
{
    using var doc = await JsonDocument.ParseAsync(ctx.Request.Body);
    var response = await server.HandleRequest(doc);
    if (response != null)
    {
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
    else
    {
        ctx.Response.StatusCode = 204;
    }
});

Console.Error.WriteLine($"aspnet on :{port}");
app.Run();
