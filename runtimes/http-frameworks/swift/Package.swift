// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "bench-vapor",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/vapor/vapor.git", from: "4.99.0"),
        .package(name: "ZeroMcp", path: "../../../zeromcp-lib"),
    ],
    targets: [
        .executableTarget(
            name: "ServerVapor",
            dependencies: [
                .product(name: "Vapor", package: "vapor"),
                .product(name: "ZeroMcp", package: "ZeroMcp"),
            ],
            path: ".",
            sources: ["server-vapor.swift"]
        ),
    ]
)
