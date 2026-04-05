plugins {
    kotlin("jvm") version "2.1.20"
    kotlin("plugin.serialization") version "2.1.20"
    application
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("io.modelcontextprotocol:kotlin-sdk:0.10.0")
    implementation("org.kotlinx:kotlinx-coroutines-core:1.10.2")
    implementation("org.kotlinx:kotlinx-serialization-json:1.8.1")
    implementation("org.kotlinx:kotlinx-io-core:0.7.0")
    implementation("io.ktor:ktor-client-cio:3.1.2")
    implementation("org.slf4j:slf4j-nop:2.0.17")
}

application {
    mainClass.set("ServerKt")
}

tasks.jar {
    manifest {
        attributes["Main-Class"] = "ServerKt"
    }
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    from(configurations.runtimeClasspath.get().map { if (it.isDirectory) it else zipTree(it) })
}

kotlin {
    jvmToolchain(21)
}
