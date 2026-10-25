// The texuli native build (spec/Compose design B2): a self-contained Gradle
// multi-project build that consumes the spec's generated Kotlin and never
// imports TypeScript or Svelte. Builds from `native/` without Node.
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
        google()
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
        google()
    }
}

rootProject.name = "texuli-native"

include(":texuli-spec", ":texuli-compose", ":conformance")
