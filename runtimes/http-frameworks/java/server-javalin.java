import com.google.gson.*;
import io.antidrift.zeromcp.*;
import io.javalin.Javalin;

/**
 * ZeroMCP over Javalin — HTTP benchmark server.
 */
public class ServerJavalin {
    public static void main(String[] args) {
        var server = new ZeroMcp();

        server.tool("hello", Tool.builder()
            .description("Say hello")
            .input(Input.required("name", "string", "Name to greet"))
            .execute((a, ctx) -> "Hello, " + a.get("name") + "!")
            .build());

        server.tool("add", Tool.builder()
            .description("Add two numbers")
            .input(Input.required("a", "number", "First number"),
                   Input.required("b", "number", "Second number"))
            .execute((a, ctx) -> {
                double x = ((Number) a.get("a")).doubleValue();
                double y = ((Number) a.get("b")).doubleValue();
                return x + y;
            })
            .build());

        var parser = new JsonParser();
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "3000"));

        var app = Javalin.create().start(port);

        app.get("/health", ctx -> ctx.json(new Gson().toJson(
            java.util.Map.of("status", "ok")
        )));

        app.post("/mcp", ctx -> {
            var req = JsonParser.parseString(ctx.body()).getAsJsonObject();
            var res = server.handleRequest(req);
            if (res != null) {
                ctx.contentType("application/json");
                ctx.result(new Gson().toJson(res));
            } else {
                ctx.status(204);
            }
        });

        System.err.println("javalin on :" + port);
    }
}
