# Native getting started

Texuli Native is an in-development Kotlin Multiplatform implementation of the Texuli blueprint contract and a Compose Desktop renderer. It is built from this repository. There is no published Maven artifact, Gradle plugin, or supported external-app integration.

## Requirements

- JDK 21.
- The Gradle wrapper and dependency versions checked into this repository.
- A checkout that includes `packages/spec/generated/kotlin`; `texuli-spec` compiles that generated source in place.

`texuli-spec` targets JVM and iOS arm64 (device and simulator). `texuli-compose` targets JVM for Compose Desktop. There is no Android target or Compose iOS renderer.

## Build and test

Run from the repository root:

```bash
./native/gradlew -p native check
```

The native README records this check passing with JDK 21. It builds the configured native modules and runs their tests; it does not publish artifacts or validate an external app integration.

To check generated parity inputs and web/native semantic traces without running the Gradle build:

```bash
pnpm exec tsx scripts/native-parity.ts --check
pnpm exec tsx native/conformance/web/trace.ts
pnpm exec tsx native/conformance/web/structure.ts
```

## Use inside the repository

The modules are `:texuli-spec`, `:texuli-compose`, and `:conformance`. They are consumed by the in-repository Gradle build, not by published coordinates. For the current embedding API, accepted blueprint behavior, placeholders, host intents, and constraints, see `native/docs/ADOPTION.md` and `native/README.md`.
