/**
 * Official MCP Java SDK server — hello + add tools over stdio.
 */

import io.modelcontextprotocol.sdk.McpServer;
import io.modelcontextprotocol.sdk.McpServerFeatures.SyncToolSpecification;
import io.modelcontextprotocol.server.transport.StdioServerTransportProvider;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.TextContent;
import io.modelcontextprotocol.spec.McpSchema.Tool;
import io.modelcontextprotocol.spec.McpSchema.ServerCapabilities;
import io.modelcontextprotocol.spec.McpJsonDefaults;

import java.util.List;
import java.util.Map;

public class Server {
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

        var addTool = Tool.builder()
            .name("add")
            .description("Add two numbers")
            .inputSchema(Tool.JsonSchema.builder()
                .type("object")
                .properties(Map.of(
                    "a", Map.of("type", "number"),
                    "b", Map.of("type", "number")))
                .required(List.of("a", "b"))
                .build())
            .build();

        McpServer.sync(transport)
            .serverInfo("official-java", "1.0.0")
            .capabilities(ServerCapabilities.builder().tools(true).build())
            .toolCall(helloTool, (exchange, request) -> {
                var arguments = request.arguments();
                String name = arguments != null && arguments.containsKey("name")
                    ? arguments.get("name").toString() : "world";
                return CallToolResult.builder()
                    .addTextContent("Hello, " + name + "!")
                    .build();
            })
            .toolCall(addTool, (exchange, request) -> {
                var arguments = request.arguments();
                double a = arguments != null && arguments.containsKey("a")
                    ? ((Number) arguments.get("a")).doubleValue() : 0;
                double b = arguments != null && arguments.containsKey("b")
                    ? ((Number) arguments.get("b")).doubleValue() : 0;
                return CallToolResult.builder()
                    .addTextContent(String.valueOf(a + b))
                    .build();
            })
            .build();
    }
}
