import Foundation
import MCP

let server = Server(
    name: "bench-official",
    version: "1.0.0",
    capabilities: .init(tools: .init())
)

server.withMethodHandler(ListTools.self) { _ in
    .init(tools: [
        Tool(
            name: "hello",
            description: "Say hello to someone",
            inputSchema: .object([
                "type": .string("object"),
                "properties": .object([
                    "name": .object(["type": .string("string")])
                ]),
                "required": .array([.string("name")])
            ])
        ),
        Tool(
            name: "add",
            description: "Add two numbers together",
            inputSchema: .object([
                "type": .string("object"),
                "properties": .object([
                    "a": .object(["type": .string("number")]),
                    "b": .object(["type": .string("number")])
                ]),
                "required": .array([.string("a"), .string("b")])
            ])
        ),
    ])
}

server.withMethodHandler(CallTool.self) { params in
    switch params.name {
    case "hello":
        let name = params.arguments?["name"]?.stringValue ?? "world"
        return .init(content: [.text(text: "Hello, \(name)!", annotations: nil, _meta: nil)])
    case "add":
        let a = params.arguments?["a"]?.doubleValue ?? 0
        let b = params.arguments?["b"]?.doubleValue ?? 0
        return .init(content: [.text(text: "{\"sum\":\(a + b)}", annotations: nil, _meta: nil)])
    default:
        return .init(content: [.text(text: "Unknown tool", annotations: nil, _meta: nil)], isError: true)
    }
}

let transport = StdioTransport()
try await server.start(transport: transport)

// Keep alive — server.start() spawns a background task but returns immediately
try await Task.sleep(for: .seconds(86400))
