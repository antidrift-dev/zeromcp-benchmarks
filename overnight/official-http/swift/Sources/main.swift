import Foundation
import MCP

@main
struct OfficialServer {
    static func main() async throws {
        let server = Server(
            name: "official-swift",
            version: "1.0.0",
            capabilities: .init(tools: .init(listChanged: false))
        )

        await server.withMethodHandler(ListTools.self) { _ in
            return .init(tools: [
                Tool(
                    name: "hello",
                    description: "Say hello",
                    inputSchema: .object([
                        "type": "object",
                        "properties": .object([
                            "name": .object(["type": "string"])
                        ]),
                        "required": .array(["name"]),
                    ])
                ),
                Tool(
                    name: "add",
                    description: "Add two numbers",
                    inputSchema: .object([
                        "type": "object",
                        "properties": .object([
                            "a": .object(["type": "number"]),
                            "b": .object(["type": "number"]),
                        ]),
                        "required": .array(["a", "b"]),
                    ])
                ),
            ])
        }

        await server.withMethodHandler(CallTool.self) { params in
            switch params.name {
            case "hello":
                let name: String
                if case .string(let s) = params.arguments?["name"] {
                    name = s
                } else {
                    name = "world"
                }
                return .init(content: [.text(text: "Hello, \(name)!", annotations: nil, _meta: nil)])

            case "add":
                let a: Double
                let b: Double
                switch params.arguments?["a"] {
                case .double(let n): a = n
                case .int(let n): a = Double(n)
                default: a = 0
                }
                switch params.arguments?["b"] {
                case .double(let n): b = n
                case .int(let n): b = Double(n)
                default: b = 0
                }
                return .init(content: [.text(text: "\(a + b)", annotations: nil, _meta: nil)])

            default:
                return .init(content: [.text(text: "Unknown tool: \(params.name)", annotations: nil, _meta: nil)], isError: true)
            }
        }

        let transport = StdioTransport()
        try await server.start(transport: transport)

        // Keep alive
        try await Task.sleep(for: .seconds(86400))
    }
}
