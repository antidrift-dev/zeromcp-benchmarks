// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "McpBenchOfficial",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/modelcontextprotocol/swift-sdk.git", from: "0.12.0"),
    ],
    targets: [
        .executableTarget(
            name: "McpBenchOfficial",
            dependencies: [
                .product(name: "MCP", package: "swift-sdk"),
            ],
            path: "Sources"
        ),
    ]
)
