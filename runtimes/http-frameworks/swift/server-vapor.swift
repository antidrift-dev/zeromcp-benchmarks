import Vapor
import ZeroMcp

/**
 * ZeroMCP over Vapor -- HTTP benchmark server.
 */
@main
struct ServerVapor {
    static func main() async throws {
        let server = ZeroMcp()

        server.tool(
            "hello",
            description: "Say hello",
            input: ["name": .extended(type: .string, description: "Name to greet")]
        ) { args, _ in
            let name = args["name"] as? String ?? "world"
            return "Hello, \(name)!"
        }

        server.tool(
            "add",
            description: "Add two numbers",
            input: [
                "a": .extended(type: .number, description: "First number"),
                "b": .extended(type: .number, description: "Second number")
            ]
        ) { args, _ in
            let a = (args["a"] as? NSNumber)?.doubleValue ?? 0.0
            let b = (args["b"] as? NSNumber)?.doubleValue ?? 0.0
            return a + b
        }

        let env = try Environment.detect()
        let app = Application(env)
        defer { app.shutdown() }

        let port = Int(ProcessInfo.processInfo.environment["PORT"] ?? "3000") ?? 3000
        app.http.server.configuration.hostname = "0.0.0.0"
        app.http.server.configuration.port = port

        app.get("health") { req -> Response in
            let body = try Response.Body(data: JSONSerialization.data(
                withJSONObject: ["status": "ok"],
                options: []
            ))
            return Response(status: .ok, headers: ["Content-Type": "application/json"], body: body)
        }

        app.post("mcp") { req -> Response in
            guard let bodyData = req.body.data,
                  let bytes = bodyData.getBytes(at: bodyData.readerIndex, length: bodyData.readableBytes),
                  let dict = try? JSONSerialization.jsonObject(with: Data(bytes)) as? [String: Any] else {
                return Response(status: .badRequest)
            }

            let result = await server.handleRequest(dict)

            if let result = result {
                let data = try JSONSerialization.data(withJSONObject: result, options: [])
                return Response(
                    status: .ok,
                    headers: ["Content-Type": "application/json"],
                    body: .init(data: data)
                )
            } else {
                return Response(status: .noContent)
            }
        }

        fputs("vapor on :\(port)\n", stderr)

        try await app.execute()
    }
}
