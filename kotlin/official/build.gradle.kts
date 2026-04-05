plugins {
    kotlin("jvm") version "2.2.21"
    application
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("io.modelcontextprotocol:kotlin-sdk:0.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
    implementation("io.ktor:ktor-client-cio:2.3.12")
    implementation("org.slf4j:slf4j-nop:2.0.13")
}

application {
    mainClass.set("McpBenchKt")
}

kotlin {
    jvmToolchain(21)
}
