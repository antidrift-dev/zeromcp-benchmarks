// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "official-swift",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/modelcontextprotocol/swift-sdk.git", from: "0.12.0"),
    ],
    targets: [
        .executableTarget(
            name: "official-server",
            dependencies: [
                .product(name: "MCP", package: "swift-sdk"),
            ],
            path: "Sources"
        ),
    ]
)
