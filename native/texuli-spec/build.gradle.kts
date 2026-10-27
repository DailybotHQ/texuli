// texuli-spec: the generated models and decoders from packages/spec (consumed
// in place, never copied), plus the hand-written JSON reader, the spec
// validator, the render plan and the semantic trace. Kotlin Multiplatform
// common code: JVM (desktop and server) and iOS (for a SwiftUI adapter,
// design decision 3).
plugins {
    alias(libs.plugins.kotlin.multiplatform)
}

kotlin {
    jvmToolchain(21)
    jvm()
    iosArm64()
    iosSimulatorArm64()

    sourceSets {
        commonMain {
            // The single source of truth: the spec generator's committed output.
            kotlin.srcDir(rootDir.resolve("../packages/spec/generated/kotlin"))
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
        }
    }
}

// Maven coordinates for the planned Central publication (decision ADR-005):
// the group is the reverse-DNS of texuli.com, which Dailybot, Inc. owns.
// Nothing is published; the module is consumed in place from this
// repository, and the version mirrors the npm prerelease line it tracks.
group = "com.texuli"
version = "0.1.0-next.3"
