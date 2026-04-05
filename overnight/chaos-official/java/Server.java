import io.modelcontextprotocol.server.McpServer;
import io.modelcontextprotocol.server.McpSyncServer;
import io.modelcontextprotocol.server.transport.StdioServerTransportProvider;
import io.modelcontextprotocol.json.McpJsonDefaults;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpSchema.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class Server {
    private static final List<byte[]> leaks = new ArrayList<>();

    public static void main(String[] args) {
        var transport = new StdioServerTransportProvider(McpJsonDefaults.getMapper());

        var helloTool = Tool.builder()
            .name("hello").description("Say hello")
            .inputSchema(new McpSchema.JsonSchema("object",
                Map.of("name", Map.of("type", "string")),
                List.of("name"), null, null, null))
            .build();

        var throwTool = Tool.builder()
            .name("throw_error").description("Tool that throws")
            .inputSchema(new McpSchema.JsonSchema("object", Map.of(), List.of(), null, null, null))
            .build();

        var hangTool = Tool.builder()
            .name("hang").description("Tool that hangs forever")
            .inputSchema(new McpSchema.JsonSchema("object", Map.of(), List.of(), null, null, null))
            .build();

        var slowTool = Tool.builder()
            .name("slow").description("Tool that takes 3 seconds")
            .inputSchema(new McpSchema.JsonSchema("object", Map.of(), List.of(), null, null, null))
            .build();

        var leakTool = Tool.builder()
            .name("leak_memory").description("Tool that leaks memory")
            .inputSchema(new McpSchema.JsonSchema("object", Map.of(), List.of(), null, null, null))
            .build();

        var stdoutTool = Tool.builder()
            .name("stdout_corrupt").description("Tool that writes to stdout")
            .inputSchema(new McpSchema.JsonSchema("object", Map.of(), List.of(), null, null, null))
            .build();

        McpSyncServer server = McpServer.sync(transport)
            .serverInfo("official-chaos", "1.0.0")
            .capabilities(ServerCapabilities.builder().tools(true).build())
            .toolCall(helloTool, (exchange, req) -> {
                var a = req.arguments();
                String name = (a != null && a.containsKey("name")) ? a.get("name").toString() : "world";
                return CallToolResult.builder().addTextContent("Hello, " + name + "!").build();
            })
            .toolCall(throwTool, (exchange, req) -> {
                throw new RuntimeException("Intentional chaos");
            })
            .toolCall(hangTool, (exchange, req) -> {
                try { Thread.sleep(86400000L); } catch (InterruptedException e) {}
                return CallToolResult.builder().addTextContent("unreachable").build();
            })
            .toolCall(slowTool, (exchange, req) -> {
                try { Thread.sleep(3000L); } catch (InterruptedException e) {}
                return CallToolResult.builder().addTextContent("{\"status\":\"ok\",\"delay_ms\":3000}").build();
            })
            .toolCall(leakTool, (exchange, req) -> {
                synchronized (leaks) {
                    leaks.add(new byte[1024 * 1024]);
                    return CallToolResult.builder().addTextContent("{\"leaked_buffers\":" + leaks.size() + "}").build();
                }
            })
            .toolCall(stdoutTool, (exchange, req) -> {
                System.out.println("CORRUPTED OUTPUT");
                System.out.flush();
                return CallToolResult.builder().addTextContent("{\"status\":\"ok\"}").build();
            })
            .build();

        try { Thread.currentThread().join(); } catch (InterruptedException e) {}
    }
}
