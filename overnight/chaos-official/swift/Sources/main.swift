import Foundation
import MCP

var leaks: [Data] = []

let server = Server(
    name: "chaos-swift",
    version: "0.1.0",
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
            name: "throw_error",
            description: "Tool that throws",
            inputSchema: .object()
        ),
        Tool(
            name: "hang",
            description: "Tool that hangs forever",
            inputSchema: .object()
        ),
        Tool(
            name: "slow",
            description: "Tool that takes 3 seconds",
            inputSchema: .object()
        ),
        Tool(
            name: "leak_memory",
            description: "Tool that leaks memory",
            inputSchema: .object()
        ),
        Tool(
            name: "stdout_corrupt",
            description: "Tool that writes to stdout",
            inputSchema: .object()
        ),
    ])
}

server.withMethodHandler(CallTool.self) { params in
    switch params.name {
    case "hello":
        let name: String
        if case .object(let dict) = params.arguments?["name"] {
            name = "world"
        } else if case .string(let s) = params.arguments?["name"] {
            name = s
        } else {
            name = "world"
        }
        return .init(content: [.text("Hello, \(name)!")])

    case "throw_error":
        throw NSError(domain: "chaos", code: 1, userInfo: [NSLocalizedDescriptionKey: "Intentional chaos: unhandled exception"])

    case "hang":
        try await Task.sleep(for: .seconds(86400))
        return .init(content: [.text("unreachable")])

    case "slow":
        try await Task.sleep(for: .seconds(3))
        return .init(content: [.text("{\"status\":\"ok\",\"delay_ms\":3000}")])

    case "leak_memory":
        leaks.append(Data(count: 1024 * 1024))
        return .init(content: [.text("{\"leaked_buffers\":\(leaks.count),\"total_mb\":\(leaks.count)}")])

    case "stdout_corrupt":
        print("CORRUPTED OUTPUT")
        fflush(stdout)
        return .init(content: [.text("{\"status\":\"ok\"}")])

    default:
        return .init(content: [.text("Unknown tool: \(params.name)")], isError: true)
    }
}

let transport = StdioTransport()
try await server.start(transport: transport)

// Keep alive
try await Task.sleep(for: .seconds(86400))
