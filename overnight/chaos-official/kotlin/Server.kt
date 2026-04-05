import io.modelcontextprotocol.kotlin.sdk.Implementation
import io.modelcontextprotocol.kotlin.sdk.ServerOptions
import io.modelcontextprotocol.kotlin.sdk.server.Server
import io.modelcontextprotocol.kotlin.sdk.server.StdioServerTransport
import io.modelcontextprotocol.kotlin.sdk.ServerCapabilities
import io.modelcontextprotocol.kotlin.sdk.Tool
import io.modelcontextprotocol.kotlin.sdk.CallToolResult
import io.modelcontextprotocol.kotlin.sdk.TextContent
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.io.asSink
import kotlinx.io.asSource
import kotlinx.io.buffered
import kotlinx.serialization.json.*

val leaks = mutableListOf<ByteArray>()

fun main() = runBlocking {
    val server = Server(
        Implementation("chaos-kotlin", "0.1.0"),
        ServerOptions(
            capabilities = ServerCapabilities(tools = ServerCapabilities.Tools(listChanged = false))
        )
    )

    server.addTool(
        Tool(
            name = "hello",
            description = "Say hello",
            inputSchema = Tool.Input(
                properties = buildJsonObject {
                    put("name", buildJsonObject {
                        put("type", JsonPrimitive("string"))
                    })
                },
                required = listOf("name")
            )
        )
    ) { request ->
        val name = request.arguments?.get("name")?.jsonPrimitive?.content ?: "world"
        CallToolResult(content = listOf(TextContent("Hello, $name!")))
    }

    server.addTool(
        Tool(
            name = "throw_error",
            description = "Tool that throws",
            inputSchema = Tool.Input()
        )
    ) { _ ->
        throw RuntimeException("Intentional chaos: unhandled exception")
    }

    server.addTool(
        Tool(
            name = "hang",
            description = "Tool that hangs forever",
            inputSchema = Tool.Input()
        )
    ) { _ ->
        delay(86400_000L)
        CallToolResult(content = listOf(TextContent("unreachable")))
    }

    server.addTool(
        Tool(
            name = "slow",
            description = "Tool that takes 3 seconds",
            inputSchema = Tool.Input()
        )
    ) { _ ->
        delay(3000L)
        CallToolResult(content = listOf(TextContent("""{"status":"ok","delay_ms":3000}""")))
    }

    server.addTool(
        Tool(
            name = "leak_memory",
            description = "Tool that leaks memory",
            inputSchema = Tool.Input()
        )
    ) { _ ->
        leaks.add(ByteArray(1024 * 1024))
        CallToolResult(content = listOf(TextContent("""{"leaked_buffers":${leaks.size},"total_mb":${leaks.size}}""")))
    }

    server.addTool(
        Tool(
            name = "stdout_corrupt",
            description = "Tool that writes to stdout",
            inputSchema = Tool.Input()
        )
    ) { _ ->
        println("CORRUPTED OUTPUT")
        CallToolResult(content = listOf(TextContent("""{"status":"ok"}""")))
    }

    val transport = StdioServerTransport(
        System.`in`.asSource().buffered(),
        System.out.asSink().buffered()
    )
    server.connect(transport)

    // Keep alive
    while (true) {
        delay(1000L)
    }
}
