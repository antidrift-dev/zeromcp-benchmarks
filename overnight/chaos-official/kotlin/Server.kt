import io.modelcontextprotocol.kotlin.sdk.types.Implementation
import io.modelcontextprotocol.kotlin.sdk.server.ServerOptions
import io.modelcontextprotocol.kotlin.sdk.server.Server
import io.modelcontextprotocol.kotlin.sdk.server.StdioServerTransport
import io.modelcontextprotocol.kotlin.sdk.server.ClientConnection
import io.modelcontextprotocol.kotlin.sdk.types.ServerCapabilities
import io.modelcontextprotocol.kotlin.sdk.types.Tool
import io.modelcontextprotocol.kotlin.sdk.types.ToolSchema
import io.modelcontextprotocol.kotlin.sdk.types.CallToolRequest
import io.modelcontextprotocol.kotlin.sdk.types.CallToolResult
import io.modelcontextprotocol.kotlin.sdk.types.TextContent
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.io.asSink
import kotlinx.io.asSource
import kotlinx.io.buffered
import kotlinx.serialization.json.*

val leaks = mutableListOf<ByteArray>()

fun main(): Unit = runBlocking {
    val server = Server(
        Implementation(name = "chaos-kotlin", version = "0.1.0"),
        ServerOptions(
            capabilities = ServerCapabilities(tools = ServerCapabilities.Tools(listChanged = false))
        )
    )

    val helloProps = buildJsonObject {
        putJsonObject("name") { put("type", "string") }
    }
    val emptyProps = buildJsonObject {}

    val helloHandler: suspend (ClientConnection, CallToolRequest) -> CallToolResult = { _, req ->
        val name = req.arguments?.get("name")?.jsonPrimitive?.content ?: "world"
        CallToolResult(content = listOf(TextContent(text = "Hello, $name!")))
    }

    server.addTool(
        Tool(name = "hello", description = "Say hello",
             inputSchema = ToolSchema(properties = helloProps, required = listOf("name"))),
        helloHandler
    )

    val throwHandler: suspend (ClientConnection, CallToolRequest) -> CallToolResult = { _, _ ->
        throw RuntimeException("Intentional chaos")
    }
    server.addTool(
        Tool(name = "throw_error", description = "Tool that throws",
             inputSchema = ToolSchema(properties = emptyProps)),
        throwHandler
    )

    val hangHandler: suspend (ClientConnection, CallToolRequest) -> CallToolResult = { _, _ ->
        delay(86400_000L)
        CallToolResult(content = listOf(TextContent(text = "unreachable")))
    }
    server.addTool(
        Tool(name = "hang", description = "Tool that hangs forever",
             inputSchema = ToolSchema(properties = emptyProps)),
        hangHandler
    )

    val slowHandler: suspend (ClientConnection, CallToolRequest) -> CallToolResult = { _, _ ->
        delay(3000L)
        CallToolResult(content = listOf(TextContent(text = """{"status":"ok","delay_ms":3000}""")))
    }
    server.addTool(
        Tool(name = "slow", description = "Tool that takes 3 seconds",
             inputSchema = ToolSchema(properties = emptyProps)),
        slowHandler
    )

    val leakHandler: suspend (ClientConnection, CallToolRequest) -> CallToolResult = { _, _ ->
        leaks.add(ByteArray(1024 * 1024))
        CallToolResult(content = listOf(TextContent(text = """{"leaked_buffers":${leaks.size}}""")))
    }
    server.addTool(
        Tool(name = "leak_memory", description = "Tool that leaks memory",
             inputSchema = ToolSchema(properties = emptyProps)),
        leakHandler
    )

    val stdoutHandler: suspend (ClientConnection, CallToolRequest) -> CallToolResult = { _, _ ->
        println("CORRUPTED OUTPUT")
        CallToolResult(content = listOf(TextContent(text = """{"status":"ok"}""")))
    }
    server.addTool(
        Tool(name = "stdout_corrupt", description = "Tool that writes to stdout",
             inputSchema = ToolSchema(properties = emptyProps)),
        stdoutHandler
    )

    val transport = StdioServerTransport(
        System.`in`.asSource().buffered(),
        System.out.asSink().buffered()
    )
    server.createSession(transport)

    while (true) { delay(1000L) }
}
