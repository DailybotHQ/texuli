# Native architecture

Texuli keeps its interface contract independent of either renderer. The TypeScript implementation uses `@texuli/spec`; generated Kotlin models and decoders are compiled from `packages/spec/generated/kotlin` by `texuli-spec`. The Kotlin code does not import TypeScript or Svelte.

## Runtime flow

1. `loadBlueprint` parses the input, decodes the generated envelope, and validates it against the spec vocabulary. Invalid input is refused with diagnostics.
2. The planner creates a render plan from a validated blueprint. Unknown or non-emittable nodes become explicit placeholders according to the host's tier.
3. `BlueprintView` renders the plan with Compose and `TexuliTheme`. A component without a native painter, or with unsupported painter props, stays visible as a placeholder.
4. The renderer reports typed intents to the host. The host decides whether an intent should cause an effect; the renderer does not perform navigation or other side effects itself.

## Modules and configured targets

| Module | Responsibility | Configured targets |
| --- | --- | --- |
| `texuli-spec` | Generated models, strict JSON decoding, validation, render planning, and semantic traces | JVM and iOS arm64 device/simulator |
| `texuli-compose` | Theme, native component registry, and Compose renderer | JVM / Compose Desktop |
| `conformance` | Kotlin-side validation, trace parity, token parity, and migration-fixture tests | JVM tests |

The Compose module has no Android or iOS target. The shared spec's iOS compilation is not an iOS UI renderer. No module is published; projects are consumed from the repository build.

## Contract boundaries

The renderer is a display projection. Interactive web data views are read-only where their native counterparts paint. Forms, editors, chat UI, and other unsupported components remain visible placeholders. Host-owned interaction and device APIs stay in the application around `BlueprintView`.

The detailed implementation and API inventory is in `native/README.md`; module adoption requirements are in `native/docs/ADOPTION.md`.
