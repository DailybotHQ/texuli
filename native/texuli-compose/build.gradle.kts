// texuli-compose: the translation registry and the first Compose renderer
// components, painting a texuli-spec render plan under a token theme.
// Compose Desktop (JVM) first; Android is pending design decision 3.
plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.compose.multiplatform)
    alias(libs.plugins.compose.compiler)
}

kotlin {
    jvmToolchain(21)
    jvm()

    sourceSets {
        commonMain.dependencies {
            api(project(":texuli-spec"))
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
        }
    }
}

// Maven coordinates for the planned Central publication (decision ADR-005):
// the group is the reverse-DNS of texuli.com, which Dailybot, Inc. owns.
// Nothing is published; the module is consumed in place from this
// repository, and the version mirrors the npm release line it tracks.
group = "com.texuli"
version = "0.2.0"
