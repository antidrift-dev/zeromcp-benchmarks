import io.modelcontextprotocol.server.McpServer;
import io.modelcontextprotocol.server.McpSyncServer;
import io.modelcontextprotocol.server.transport.StdioServerTransportProvider;
import io.modelcontextprotocol.json.McpJsonDefaults;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpSchema.*;

import java.util.List;
import java.util.Map;

public class McpBench {
    public static void main(String[] args) {
        var transport = new StdioServerTransportProvider(McpJsonDefaults.getMapper());

        var helloTool = Tool.builder()
            .name("hello")
            .description("Say hello to someone")
            .inputSchema(new McpSchema.JsonSchema("object",
                Map.of("name", Map.of("type", "string")),
                List.of("name"), null, null, null))
            .build();

        var addTool = Tool.builder()
            .name("add")
            .description("Add two numbers together")
            .inputSchema(new McpSchema.JsonSchema("object",
                Map.of("a", Map.of("type", "number"), "b", Map.of("type", "number")),
                List.of("a", "b"), null, null, null))
            .build();

        McpSyncServer server = McpServer.sync(transport)
            .serverInfo("bench-official", "1.0.0")
            .capabilities(ServerCapabilities.builder().tools(true).build())
            .toolCall(helloTool, (exchange, req) -> {
                var name = req.arguments().get("name").toString();
                return CallToolResult.builder()
                    .addTextContent(String.format("Hello, %s!", name))
                    .build();
            })
            .toolCall(addTool, (exchange, req) -> {
                var a = ((Number) req.arguments().get("a")).doubleValue();
                var b = ((Number) req.arguments().get("b")).doubleValue();
                return CallToolResult.builder()
                    .addTextContent(String.format("{\"sum\":%s}", a + b))
                    .build();
            })
            .build();

        try { Thread.currentThread().join(); } catch (InterruptedException e) {}
    }
}
