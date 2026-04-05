// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "chaos-swift",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/modelcontextprotocol/swift-sdk.git", from: "0.12.0"),
    ],
    targets: [
        .executableTarget(
            name: "chaos-server",
            dependencies: [
                .product(name: "MCP", package: "swift-sdk"),
            ],
            path: "Sources"
        ),
    ]
)
