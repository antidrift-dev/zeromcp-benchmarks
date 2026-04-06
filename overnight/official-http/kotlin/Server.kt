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

fun main(): Unit = runBlocking {
    val server = Server(
        Implementation(name = "official-kotlin", version = "1.0.0"),
        ServerOptions(
            capabilities = ServerCapabilities(tools = ServerCapabilities.Tools(listChanged = false))
        )
    )

    val helloHandler: suspend (ClientConnection, CallToolRequest) -> CallToolResult = { _, request ->
        val name = request.arguments?.get("name")?.jsonPrimitive?.content ?: "world"
        CallToolResult(content = listOf(TextContent(text = "Hello, $name!")))
    }

    server.addTool(
        Tool(
            name = "hello",
            description = "Say hello",
            inputSchema = ToolSchema(
                properties = buildJsonObject {
                    putJsonObject("name") { put("type", "string") }
                },
                required = listOf("name")
            )
        ),
        helloHandler
    )

    val addHandler: suspend (ClientConnection, CallToolRequest) -> CallToolResult = { _, request ->
        val a = request.arguments?.get("a")?.jsonPrimitive?.double ?: 0.0
        val b = request.arguments?.get("b")?.jsonPrimitive?.double ?: 0.0
        CallToolResult(content = listOf(TextContent(text = "${a + b}")))
    }

    server.addTool(
        Tool(
            name = "add",
            description = "Add two numbers",
            inputSchema = ToolSchema(
                properties = buildJsonObject {
                    putJsonObject("a") { put("type", "number") }
                    putJsonObject("b") { put("type", "number") }
                },
                required = listOf("a", "b")
            )
        ),
        addHandler
    )

    val transport = StdioServerTransport(
        System.`in`.asSource().buffered(),
        System.out.asSink().buffered()
    )
    server.createSession(transport)

    // Keep alive
    while (true) {
        delay(1000L)
    }
}
