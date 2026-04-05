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

fun main() = runBlocking {
    val server = Server(
        Implementation("official-kotlin", "1.0.0"),
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
            name = "add",
            description = "Add two numbers",
            inputSchema = Tool.Input(
                properties = buildJsonObject {
                    put("a", buildJsonObject {
                        put("type", JsonPrimitive("number"))
                    })
                    put("b", buildJsonObject {
                        put("type", JsonPrimitive("number"))
                    })
                },
                required = listOf("a", "b")
            )
        )
    ) { request ->
        val a = request.arguments?.get("a")?.jsonPrimitive?.double ?: 0.0
        val b = request.arguments?.get("b")?.jsonPrimitive?.double ?: 0.0
        CallToolResult(content = listOf(TextContent("${a + b}")))
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
