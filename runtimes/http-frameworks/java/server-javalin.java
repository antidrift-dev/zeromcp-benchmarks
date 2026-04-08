import com.google.gson.*;
import io.antidrift.zeromcp.*;
import io.javalin.Javalin;

import java.time.Instant;
import java.util.List;

/**
 * ZeroMCP over Javalin — HTTP benchmark server.
 */
public class ServerJavalin {
    public static void main(String[] args) {
        var server = new ZeroMcp();

        // ---- Tools ----

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

        // ---- Resources ----

        server.resource("data", ResourceDef.builder()
            .uri("resource:///data.json")
            .description("Static benchmark data")
            .mimeType("application/json")
            .read(() -> "{\"benchmark\":true,\"items\":[1,2,3]}")
            .build());

        server.resource("dynamic", ResourceDef.builder()
            .uri("resource:///dynamic")
            .description("Dynamic resource returning current timestamp")
            .mimeType("application/json")
            .read(() -> "{\"ts\":\"" + Instant.now() + "\"}")
            .build());

        // ---- Prompts ----

        server.prompt("greet", PromptDef.builder()
            .description("Generate a greeting")
            .argument(PromptArgument.required("name", "Name to greet"),
                      PromptArgument.optional("tone", "Tone of the greeting"))
            .render(a -> {
                var name = (String) a.get("name");
                var tone = a.containsKey("tone") ? (String) a.get("tone") : "friendly";
                return List.of(
                    new PromptMessage("user",
                        "Greet " + name + " in a " + tone + " tone.")
                );
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
