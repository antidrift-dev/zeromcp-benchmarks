import io.antidrift.zeromcp.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*

/**
 * ZeroMCP over Ktor/Netty -- HTTP benchmark server.
 */
fun main() {
    val server = ZeroMcp()

    server.tool("hello") {
        description = "Say hello"
        input { required("name", "string", "Name to greet") }
        execute { args, _ -> "Hello, ${args.getString("name")}!" }
    }

    server.resource("data") {
        uri = "resource:///data.json"
        mimeType = "application/json"
        read { """{"key":"value","count":42}""" }
    }

    server.resource("dynamic") {
        uri = "resource:///dynamic"
        mimeType = "application/json"
        read { """{"dynamic":true}""" }
    }

    server.prompt("greet") {
        description = "Greeting"
        arguments {
            required("name")
            optional("tone", "formal or casual")
        }
        render { args ->
            listOf(
                PromptMessage(
                    role = "user",
                    content = PromptContent(text = "Greet ${args.getString("name")} in a ${args.getString("tone") ?: "casual"} tone")
                )
            )
        }
    }

    server.tool("add") {
        description = "Add two numbers"
        input {
            required("a", "number", "First number")
            required("b", "number", "Second number")
        }
        execute { args, _ ->
            val a = args.getNumber("a") ?: 0.0
            val b = args.getNumber("b") ?: 0.0
            a + b
        }
    }

    val json = Json { ignoreUnknownKeys = true }
    val port = System.getenv("PORT")?.toIntOrNull() ?: 3000

    embeddedServer(Netty, port = port) {
        routing {
            get("/health") {
                call.respondText(
                    """{"status":"ok"}""",
                    ContentType.Application.Json
                )
            }

            post("/mcp") {
                val body = call.receiveText()
                val req = json.parseToJsonElement(body).jsonObject
                val res = server.handleRequest(req)
                if (res != null) {
                    call.respondText(
                        json.encodeToString(JsonObject.serializer(), res),
                        ContentType.Application.Json
                    )
                } else {
                    call.respond(HttpStatusCode.NoContent)
                }
            }
        }
    }.start(wait = false)

    System.err.println("ktor on :$port")

    // Keep main thread alive
    Thread.currentThread().join()
}
