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
