import io.modelcontextprotocol.kotlin.sdk.types.*
import io.modelcontextprotocol.kotlin.sdk.server.Server
import io.modelcontextprotocol.kotlin.sdk.server.ServerOptions
import io.modelcontextprotocol.kotlin.sdk.server.StdioServerTransport
import io.modelcontextprotocol.kotlin.sdk.server.ClientConnection
import kotlinx.coroutines.runBlocking
import kotlinx.io.asSink
import kotlinx.io.asSource
import kotlinx.io.buffered
import kotlinx.serialization.json.*

fun main(): Unit = runBlocking {
    val server = Server(
        Implementation(name = "bench-official", version = "1.0.0"),
        ServerOptions(
            capabilities = ServerCapabilities(tools = ServerCapabilities.Tools(listChanged = true))
        )
    )

    val helloProps = buildJsonObject {
        putJsonObject("name") { put("type", "string") }
    }
    val addProps = buildJsonObject {
        putJsonObject("a") { put("type", "number") }
        putJsonObject("b") { put("type", "number") }
    }

    val helloTool = Tool(
        name = "hello",
        inputSchema = ToolSchema(properties = helloProps, required = listOf("name")),
        description = "Say hello to someone"
    )

    val addTool = Tool(
        name = "add",
        inputSchema = ToolSchema(properties = addProps, required = listOf("a", "b")),
        description = "Add two numbers together"
    )

    val helloHandler: suspend (ClientConnection, CallToolRequest) -> CallToolResult = { _, req ->
        val name = req.arguments!!["name"]?.jsonPrimitive?.content ?: "world"
        CallToolResult(content = listOf(TextContent(text = "Hello, $name!")))
    }

    val addHandler: suspend (ClientConnection, CallToolRequest) -> CallToolResult = { _, req ->
        val a = req.arguments!!["a"]?.jsonPrimitive?.double ?: 0.0
        val b = req.arguments!!["b"]?.jsonPrimitive?.double ?: 0.0
        CallToolResult(content = listOf(TextContent(text = """{"sum":${a + b}}""")))
    }

    server.addTool(helloTool, helloHandler)
    server.addTool(addTool, addHandler)

    val transport = StdioServerTransport(
        System.`in`.asSource().buffered(),
        System.out.asSink().buffered()
    )
    server.createSession(transport)
    // Keep alive until stdin closes
    while (System.`in`.available() >= 0) {
        kotlinx.coroutines.delay(100)
    }
}
