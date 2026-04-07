package bench;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class Tools {

    @Tool(description = "Say hello")
    public String hello(@ToolArg(description = "Name to greet") String name) {
        return "Hello, " + name + "!";
    }

    @Tool(description = "Add two numbers")
    public double add(
            @ToolArg(description = "First number") double a,
            @ToolArg(description = "Second number") double b) {
        return a + b;
    }
}
