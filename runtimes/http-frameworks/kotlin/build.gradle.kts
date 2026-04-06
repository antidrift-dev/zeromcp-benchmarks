plugins {
    kotlin("jvm") version "2.0.21"
    kotlin("plugin.serialization") version "2.0.21"
    application
}

group = "io.antidrift"
version = "1.0.0"

repositories {
    mavenCentral()
}

val ktorVersion = "3.0.1"

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
    implementation("io.ktor:ktor-server-core:$ktorVersion")
    implementation("io.ktor:ktor-server-netty:$ktorVersion")
    implementation("io.ktor:ktor-server-content-negotiation:$ktorVersion")
    implementation("ch.qos.logback:logback-classic:1.5.12")
    implementation(files("lib/zeromcp.jar"))
}

kotlin {
    jvmToolchain(21)
}

application {
    mainClass.set("Server_ktorKt")
}

tasks.named<JavaExec>("run") {
    standardOutput = System.out
    errorOutput = System.err
}
