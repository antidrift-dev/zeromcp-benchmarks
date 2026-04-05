import Foundation
import MCP

nonisolated(unsafe) var leaks: [Data] = []

let server = Server(
    name: "chaos-swift",
    version: "0.1.0",
    capabilities: .init(tools: .init())
)

await server.withMethodHandler(ListTools.self) { _ in
    .init(tools: [
        Tool(name: "hello", description: "Say hello",
             inputSchema: .object(["type": .string("object"), "properties": .object(["name": .object(["type": .string("string")])])])),
        Tool(name: "throw_error", description: "Tool that throws",
             inputSchema: .object(["type": .string("object")])),
        Tool(name: "hang", description: "Tool that hangs forever",
             inputSchema: .object(["type": .string("object")])),
        Tool(name: "slow", description: "Tool that takes 3 seconds",
             inputSchema: .object(["type": .string("object")])),
        Tool(name: "leak_memory", description: "Tool that leaks memory",
             inputSchema: .object(["type": .string("object")])),
        Tool(name: "stdout_corrupt", description: "Tool that writes to stdout",
             inputSchema: .object(["type": .string("object")])),
    ])
}

await server.withMethodHandler(CallTool.self) { params in
    switch params.name {
    case "hello":
        let name = params.arguments?["name"]?.stringValue ?? "world"
        return .init(content: [.text(text: "Hello, \(name)!", annotations: nil, _meta: nil)])
    case "throw_error":
        throw NSError(domain: "chaos", code: 1, userInfo: [NSLocalizedDescriptionKey: "Intentional chaos"])
    case "hang":
        try await Task.sleep(for: .seconds(86400))
        return .init(content: [.text(text: "unreachable", annotations: nil, _meta: nil)])
    case "slow":
        try await Task.sleep(for: .seconds(3))
        return .init(content: [.text(text: "{\"status\":\"ok\",\"delay_ms\":3000}", annotations: nil, _meta: nil)])
    case "leak_memory":
        leaks.append(Data(count: 1024 * 1024))
        return .init(content: [.text(text: "{\"leaked_buffers\":\(leaks.count)}", annotations: nil, _meta: nil)])
    case "stdout_corrupt":
        print("CORRUPTED OUTPUT")
        return .init(content: [.text(text: "{\"status\":\"ok\"}", annotations: nil, _meta: nil)])
    default:
        return .init(content: [.text(text: "Unknown tool", annotations: nil, _meta: nil)], isError: true)
    }
}

let transport = StdioTransport()
try await server.start(transport: transport)
try await Task.sleep(for: .seconds(86400))
