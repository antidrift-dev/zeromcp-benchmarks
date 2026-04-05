/**
 * Official MCP Java SDK server with chaos tools for resilience testing.
 */

import io.modelcontextprotocol.sdk.McpServer;
import io.modelcontextprotocol.sdk.McpServerFeatures.SyncToolSpecification;
import io.modelcontextprotocol.server.transport.StdioServerTransportProvider;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.TextContent;
import io.modelcontextprotocol.spec.McpSchema.Tool;
import io.modelcontextprotocol.spec.McpSchema.ServerCapabilities;
import io.modelcontextprotocol.spec.McpJsonDefaults;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class Server {
    private static final List<byte[]> leaks = new ArrayList<>();

    public static void main(String[] args) {
        var transport = new StdioServerTransportProvider(McpJsonDefaults.getMapper());

        var helloTool = Tool.builder()
            .name("hello")
            .description("Say hello")
            .inputSchema(Tool.JsonSchema.builder()
                .type("object")
                .properties(Map.of("name", Map.of("type", "string")))
                .required(List.of("name"))
                .build())
            .build();

        var throwErrorTool = Tool.builder()
            .name("throw_error")
            .description("Tool that throws")
            .inputSchema(Tool.JsonSchema.builder()
                .type("object")
                .properties(Map.of())
                .build())
            .build();

        var hangTool = Tool.builder()
            .name("hang")
            .description("Tool that hangs forever")
            .inputSchema(Tool.JsonSchema.builder()
                .type("object")
                .properties(Map.of())
                .build())
            .build();

        var slowTool = Tool.builder()
            .name("slow")
            .description("Tool that takes 3 seconds")
            .inputSchema(Tool.JsonSchema.builder()
                .type("object")
                .properties(Map.of())
                .build())
            .build();

        var leakMemoryTool = Tool.builder()
            .name("leak_memory")
            .description("Tool that leaks memory")
            .inputSchema(Tool.JsonSchema.builder()
                .type("object")
                .properties(Map.of())
                .build())
            .build();

        var stdoutCorruptTool = Tool.builder()
            .name("stdout_corrupt")
            .description("Tool that writes to stdout")
            .inputSchema(Tool.JsonSchema.builder()
                .type("object")
                .properties(Map.of())
                .build())
            .build();

        McpServer.sync(transport)
            .serverInfo("official-chaos", "1.0.0")
            .capabilities(ServerCapabilities.builder().tools(true).build())
            .toolCall(helloTool, (exchange, request) -> {
                var arguments = request.arguments();
                String name = arguments != null && arguments.containsKey("name")
                    ? arguments.get("name").toString() : "world";
                return CallToolResult.builder()
                    .addTextContent("Hello, " + name + "!")
                    .build();
            })
            .toolCall(throwErrorTool, (exchange, request) -> {
                throw new RuntimeException("Intentional chaos: unhandled exception");
            })
            .toolCall(hangTool, (exchange, request) -> {
                Thread.sleep(86400000L);
                return CallToolResult.builder()
                    .addTextContent("unreachable")
                    .build();
            })
            .toolCall(slowTool, (exchange, request) -> {
                Thread.sleep(3000L);
                return CallToolResult.builder()
                    .addTextContent("{\"status\":\"ok\",\"delay_ms\":3000}")
                    .build();
            })
            .toolCall(leakMemoryTool, (exchange, request) -> {
                synchronized (leaks) {
                    leaks.add(new byte[1024 * 1024]);
                    int count = leaks.size();
                    return CallToolResult.builder()
                        .addTextContent("{\"leaked_buffers\":" + count + ",\"total_mb\":" + count + "}")
                        .build();
                }
            })
            .toolCall(stdoutCorruptTool, (exchange, request) -> {
                System.out.write("CORRUPTED OUTPUT\n".getBytes());
                System.out.flush();
                return CallToolResult.builder()
                    .addTextContent("{\"status\":\"ok\"}")
                    .build();
            })
            .build();
    }
}
