// conformance: the native half of the dual-target golden gate (design §7.2).
// Each spec golden blueprint is decoded, validated and planned, and its
// semantic trace must equal the committed trace the web target produced.
plugins {
    alias(libs.plugins.kotlin.multiplatform)
}

kotlin {
    jvmToolchain(21)
    jvm()

    sourceSets {
        jvmTest.dependencies {
            implementation(project(":texuli-compose"))
            implementation(libs.kotlin.test)
        }
    }
}

tasks.withType<Test>().configureEach {
    // Fixtures are read from the repository: the spec goldens and the expected traces.
    systemProperty("texuli.repo", rootDir.resolve("..").absolutePath)
}
