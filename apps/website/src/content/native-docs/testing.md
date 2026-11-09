# Native testing

The native checks cover generated Kotlin structure, blueprint validation, deterministic render plans, Compose projections, and web/native conformance evidence. They do not establish device-level accessibility or visual parity.

## Repository checks

Run the generated-source and trace checks from the repository root:

```bash
pnpm vitest run packages/spec
pnpm exec tsx scripts/native-parity.ts --check
pnpm exec tsx native/conformance/web/trace.ts
pnpm exec tsx native/conformance/web/structure.ts
```

With JDK 21 and the Kotlin/Native toolchain available, run the Gradle check:

```bash
./native/gradlew -p native check
```

The Gradle check runs the configured JVM suites and the `texuli-spec` iOS compilation/test tasks. Compose UI has only the configured JVM target.

## What the tests establish

- Spec tests check strict JSON parsing, schema validation, tier gates, and contract error parity.
- Compose tests check supported projections, bounded inputs, accessibility semantics exposed by the implementation, and visible failure placeholders.
- Conformance tests compare native output with web-written golden and parity traces and exercise the checked-in migration fixtures.
- The chart-vector and native-parity generators verify their checked-in inputs against the web implementation and native registry.

## Known test limits

The native suites are deterministic unit and conformance checks. They do not launch the six external KMP sample apps, verify screenshot equivalence, or exercise device-specific TalkBack and VoiceOver output. No Compose UI-test suite is wired. A successful contract or JVM test does not mean an Android or iOS UI renderer exists.
