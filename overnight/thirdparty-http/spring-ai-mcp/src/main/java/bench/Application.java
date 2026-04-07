package bench;

import java.util.List;
import java.util.Map;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @Bean
    public Tools tools() {
        return new Tools();
    }

    public static class Tools {

        @Tool(description = "Say hello to someone")
        public String hello(@ToolParam(description = "The name to greet") String name) {
            return "Hello, " + name + "!";
        }

        @Tool(description = "Add two numbers")
        public double add(
                @ToolParam(description = "First number") double a,
                @ToolParam(description = "Second number") double b) {
            return a + b;
        }
    }
}
