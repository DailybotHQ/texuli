# Adopting the native renderer

This guide is for a host developer who wants to paint Texuli blueprints in a
Kotlin Multiplatform app with the native renderer. It describes what works on
`dev` today. The [native README](../README.md) is the source of truth for
widget details, and its **Modules** table and **Native test map** say what is
built and tested.

**Status: in development, nothing published.** No Maven artifact, Gradle
plugin or release exists. The build has no `group`, `version` or publishing
configuration (`native/build.gradle.kts`, `native/settings.gradle.kts`). It
runs only as a local build inside a checkout of this repository.

## What loads and paints today

The flow (`texuli-spec/src/commonMain/kotlin/com/texuli/spec/runtime/RenderPlan.kt`,
`texuli-compose/src/commonMain/kotlin/com/texuli/compose/BlueprintView.kt`):
1. `loadBlueprint` parses the JSON, decodes the envelope with the generated
   models, and validates the tree against the spec vocabulary. Anything
   invalid is **refused** with diagnostics, never repaired.
2. It plans a validated tree into `PlanNode`s: extension props are dropped,
   and ids that cannot paint become placeholders.
3. `BlueprintView` paints the plan. A node without a native painter, or with
   props the painter does not accept, paints a visible placeholder:
   `"<id>" is not shown here (<reason>)`. It is never blank and never a crash.

**Painted natively** (`NativeRegistry.implemented` in
`texuli-compose/src/commonMain/kotlin/com/texuli/compose/Registry.kt`), 40 ids.
The full table, generated from the registry and the catalog, is
[PARITY.md](PARITY.md):

| Group | Ids |
| --- | --- |
| Layouts | `layout-page`, `layout-doc`, `layout-deck`, `layout-card`, `layout-grid`, `deck-slide` |
| Composition layouts (0.8.0) | `layout-stack`, `layout-row`, `layout-split`, `layout-tile` |
| Content blocks | `blocks-text` (heading, text, list, quote, callout), `blocks-data` (stat, KPI, table), `blocks-diagram` (static board), `blocks-code`, `blocks-structure` (CTA, divider, columns) |
| Media | `media-image`, `blocks-media` (image, figure, video, gallery): frames with alt text, no decoded pixels |
| Compact charts | `charts-sparkline`, `charts-bullet`, `charts-gauge`, `charts-progress-ring` |
| Cartesian charts (ADR-025) | `charts-line`, `charts-area`, `charts-bar`, `charts-stacked-bar`, `charts-combo`, `charts-cartesian`, `charts-canvas-renderer`: the web's layout ported to Kotlin and checked against web-written vectors |
| Part-whole charts (ADR-025) | `charts-pie`, `charts-donut`, `charts-sunburst`, `charts-treemap`, with the web's legend and data table |
| Matrix and flow charts (ADR-025) | `charts-scatter`, `charts-bubble`, `charts-heatmap`, `charts-funnel`, `charts-sankey`, `charts-network` |
| Geo charts (ADR-025) | `charts-geo-map`, `charts-geo-point-map`: the web's schematic tile maps, with no geographic data and no network |

Every other id paints a placeholder. Of the 168 spec vocabulary ids, 75 may be
emitted by a blueprint (their catalog `emit` list holds both `developer` and
`untrusted`). The other 93 have an empty `emit` list: every form control, the
app-shell layouts and the standalone UI components. Those plan to
`tier-denied` at any tier. Emittable ids without a painter, such as the other
chart families, `media-composition-svg` and `media-composition-canvas`, paint
`not-on-this-target`.

**Placeholder reasons**, as painted:

| Reason | Where it comes from |
| --- | --- |
| `unknown-id` | Planning: the id is not in the component list passed to `loadBlueprint` |
| `tier-denied` | Planning: the catalog's `emit` list for the id lacks the host's tier (the node's subtree is dropped too) |
| `not-on-this-target` | Painting: no native painter for the id, for a `blocks-data` type other than stat, KPI and table, or for a `blocks-diagram` that is not a board |
| `invalid-chart-data`, `invalid-table`, `invalid-list`, `invalid-media` | Painting: props outside what the native projection accepts |
| `unsupported-gap`, `unsupported-deck-options` | Painting: grid gaps or deck options outside the supported set |
| `unknown-block` | Painting: a `blocks-text` or `blocks-data` node without a `block`, or a `blocks-text` type other than heading, text, list, quote and callout |

An id that is not in the spec vocabulary at all is **refused** at validation
(`unknown-id` diagnostic) before planning, so the whole blueprint does not
load. `chat-thread` and `chat-message` were the worked example until spec
0.3.0 added them; they now validate and paint `not-on-this-target`.

## Requirements

- **JDK 21.** Each module declares `jvmToolchain(21)`. This host's default
  JDK 26 is rejected by Kotlin's version parser, so select 21 explicitly (see
  [Building](../README.md#building)).
- **Gradle 8.14.3**, through the wrapper (`native/gradle/wrapper/gradle-wrapper.properties`).
- **Pins** (`native/gradle/libs.versions.toml`): Kotlin 2.3.20 and Compose
  Multiplatform 1.10.3. They are **proposed, not ratified**: ratifying them is
  open design decision 5.
- **The repository checkout.** `texuli-spec` compiles the spec's generated
  Kotlin in place from `packages/spec/generated/kotlin` (a `srcDir`, never a
  copy), so `native/` cannot build outside this repository.
- **Targets.** `texuli-spec`: JVM, iOS arm64 and iOS simulator arm64.
  `texuli-compose`: JVM only (Compose Desktop). There is no Android target and
  no Compose iOS target; both wait on design decision 3.

## Consuming it

There are no module coordinates to depend on. The Gradle projects are
`:texuli-spec`, `:texuli-compose` (which exposes `texuli-spec` as an `api`
dependency) and `:conformance` (tests only), in the build named
`texuli-native`.

What works today is building and testing inside `native/`, with the Gradle and
Kotlin/Native caches isolated under the lane's `tmp/`:

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 21) \
  GRADLE_USER_HOME="$PWD/tmp/gradle-home" \
  KONAN_DATA_DIR="$PWD/tmp/gradle-home/konan" \
  ./native/gradlew -p native check
```

Embedding these projects in another app's build (an included build with
dependency substitution, or published artifacts) has **not been tried or
tested**. Publishing is a release decision for the owner; until then, treat
any outside integration as unsupported.

## The API

### `loadBlueprint`

```kotlin
fun loadBlueprint(
    text: String,
    components: List<SpecComponent> = SpecVocabulary.components,
    catalogHash: String? = null,
    tier: SpecComponentEmit = SpecComponentEmit.UNTRUSTED,
): LoadResult
```

- `LoadResult.Ready(envelope, plan)`: the decoded `BlueprintEnvelope` and a
  one-root `List<PlanNode>`.
- `LoadResult.Refused(diagnostics)`: `SpecDiagnostic(code, path, message, id)`,
  with the TypeScript validator's codes (`schema`, `unknown-id`,
  `unknown-prop`, `prop-type`, `enum-value`, `missing-required`,
  `extension-prop`, `catalog-mismatch`, `unsupported-profile`,
  `unknown-slot`). `InvalidFixtureParityTest` holds that parity.
- `catalogHash`: when set, a blueprint bound to another catalog is refused
  with `catalog-mismatch`.
- `tier`: **the host's decision, never the envelope's.** The envelope's
  declared `tier` is display data. The default is the stricter `untrusted`,
  as on the web. An id whose catalog `emit` list lacks the tier plans to
  `PlanNode.Placeholder(id, "tier-denied")`, with its subtree dropped.
  Validation checks structure only and never reads `emit`, so this gate is a
  render-time policy on both targets (`RenderPlanTest`). Today the two tiers
  plan the same: the 75 emittable ids allow both, and the other 93 (every
  control, such as `button`, `input`, `textarea` and `form`) allow neither,
  so they are `tier-denied` at every tier.
- **Profiles.** A `portable` envelope is refused with `unsupported-profile`
  for every id that is not portable core. No id is portable core yet: of the
  168 vocabulary entries, 21 are `unknown` and 147 are `web-only`, so only
  `web`-profile blueprints load.

### `BlueprintView` and intents

```kotlin
@Composable
fun BlueprintView(plan: List<PlanNode>, onIntent: (TexuliIntent) -> Unit = {})
```

Wrap it in `TexuliTheme(dark = …) { … }` for the token colors
(`TexuliTheme.kt`, generated design tokens; pass `tokens = DesignTokens.Acme`
or another generated set to brand it). The renderer never performs an effect. It reports intents
(`Intents.kt`), and the host decides whether to act on them, behind its own
confirmation:

```kotlin
sealed interface TexuliIntent {
    val path: String
    data class Navigate(override val path: String, val href: String) : TexuliIntent
    data class Copy(override val path: String, val text: String) : TexuliIntent
}
```

- `path` is the node's plan path (`0.children.1`).
- `Navigate` is built only for `https:` links (`navigateIntent`). Today the
  only emitter is a linked `media-image` (`MediaWidgets.kt`).
- `Copy` is defined but no painter emits it yet.
- There is no activate intent: activation and every control stay with the
  host.

A minimal host, then:

```kotlin
when (val result = loadBlueprint(json)) {
    is LoadResult.Ready -> TexuliTheme {
        BlueprintView(result.plan) { intent -> /* confirm, then act */ }
    }
    is LoadResult.Refused -> /* show result.diagnostics to the author */
}
```

## Worked examples: the six KMP apps

Each test-bench app was checked without changing the app. Its screen is
expressed as fictional static blueprints in `native/conformance/fixtures/`,
and a conformance test pins each widget's status:

| App | Guide | What it shows |
| --- | --- | --- |
| KMPStarter | [kmp-starter-migration.md](kmp-starter-migration.md) | Text and image in a page; the button toggle stays app code |
| KMPTodoApp | [kmp-todo-migration.md](kmp-todo-migration.md) | A static task list; editing controls stay app code |
| KMPAIChat | [kmp-aichat-migration.md](kmp-aichat-migration.md) | The `chat-thread` form validates but has no native painter; a text-block fallback loads painted |
| KMPAIVoiceChat | [kmp-voicechat-migration.md](kmp-voicechat-migration.md) | Chat and realtime screens load; the `chat-thread` form validates with roles mapped; audio stays platform code |
| KMPPTTDynamics | [kmp-pttdynamics-migration.md](kmp-pttdynamics-migration.md) | Five room snapshots load; live controls and audio stay app code |
| KMPTapDuelGame | [kmp-tapduel-migration.md](kmp-tapduel-migration.md) | A scoreboard snapshot loads; tap zones are `tier-denied`; the portable profile refuses it |

Across all six, only a static display projection migrates. Interaction, live
state, audio and anything time-based stays in the app, around
`BlueprintView`.

## Roadmap: the documented gaps

Everything below is **planned, not built**. Each item is a gap a migration
doc or the README records:

- **Publishing.** Coordinates, versioning and a release, after the owner
  ratifies the pins (design decision 5).
- **Targets.** Android and Compose iOS (design decision 3).
- **A native chat painter.** Spec 0.3.0 lists `chat-thread` and
  `chat-message` (both `web-only`), so chat blueprints
  validate natively, but no native painter exists: they paint
  `not-on-this-target` (KMPAIChat, KMPAIVoiceChat). Next would be a display
  painter for the thread and message. The composer (text field and send)
  is host chrome on every target: the web host or the native app provides
  it, and it is not part of the blueprint.
- **An audio surface.** No audio id or block type exists, and there is no
  native audio painter (KMPAIVoiceChat, KMPPTTDynamics).
- **Portable core.** It is empty until ids pass the audit and cross-target
  conformance, so `portable` blueprints are refused (KMPTapDuelGame).
- **Media pixels.** Decoding data-URI images, a host-supplied loader for
  `https:` and relative sources, video playback, and a media conformance
  golden.
- **More painters:** `media-composition-canvas` and `media-composition-svg`
  (KMPTapDuelGame's goal markers), the other chart families, and app-shell
  layouts.
- **Copy intents** from painters that offer copyable text.
- **UI-level tests.** Compose semantics-tree, screenshot and interaction
  tests are not wired. A Desktop UI-test run stalled in macOS AWT/AppKit
  initialization. Heading rank is conveyed visually only.
- **Build hardening:** dependency locking or verification, configuration
  cache and a cold-cache timing baseline. These are owner decisions.

Controls and live interaction are not on this list on purpose: the catalog
keeps them as host chrome, never blueprint content.
