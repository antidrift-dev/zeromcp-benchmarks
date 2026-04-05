import Foundation
import MCP

let server = Server(
    name: "official-swift",
    version: "1.0.0",
    capabilities: .init(tools: .init(listChanged: false))
)

server.withMethodHandler(ListTools.self) { _ in
    return .init(tools: [
        Tool(
            name: "hello",
            description: "Say hello",
            inputSchema: .object(
                properties: ["name": .string],
                required: ["name"]
            )
        ),
        Tool(
            name: "add",
            description: "Add two numbers",
            inputSchema: .object(
                properties: [
                    "a": .number,
                    "b": .number,
                ],
                required: ["a", "b"]
            )
        ),
    ])
}

server.withMethodHandler(CallTool.self) { params in
    switch params.name {
    case "hello":
        let name: String
        if case .string(let s) = params.arguments?["name"] {
            name = s
        } else {
            name = "world"
        }
        return .init(content: [.text("Hello, \(name)!")])

    case "add":
        let a: Double
        let b: Double
        if case .number(let n) = params.arguments?["a"] {
            a = n
        } else {
            a = 0
        }
        if case .number(let n) = params.arguments?["b"] {
            b = n
        } else {
            b = 0
        }
        return .init(content: [.text("\(a + b)")])

    default:
        return .init(content: [.text("Unknown tool: \(params.name)")], isError: true)
    }
}

let transport = StdioTransport()
try await server.start(transport: transport)

// Keep alive
try await Task.sleep(for: .seconds(86400))
