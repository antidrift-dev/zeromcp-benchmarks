using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var builder = Host.CreateApplicationBuilder(args);
builder.Logging.ClearProviders();

builder.Services.AddMcpServer()
    .WithStdioServerTransport()
    .WithTools<BenchTools>();

await builder.Build().RunAsync();
