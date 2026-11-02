# texuli native

The self-contained Gradle Kotlin Multiplatform build for Texuli's native
target (spec/Compose design, plans B1 and B2). It consumes the blueprint
contract from [`@texuli/spec`](../packages/spec/README.md) and never imports
TypeScript or Svelte. It is not a pnpm workspace package.

**Status: in development.** The Compose renderer contains native ordered and
unordered text lists plus a static, horizontally scrollable board projection
(column headings, card counts and plain-text cards), alongside a native
table-block projection, bounded responsive content layouts, the compact
charts (`charts-sparkline`, `charts-bullet`, `charts-gauge`, and
`charts-progress-ring`) and, since PLAN_013 ([ADR-025](../docs/DECISIONS.md#adr-025-native-painting-from-ported-web-math)),
every chart family and every data view: cartesian, part-whole, matrix, flow and geo
charts, and the grid, cohort table, tree, files, calendar, timeline,
notification inbox, board, map, dashboard and filter builder. Their layouts are
the web's own chart and data math, ported to Kotlin and checked against
vectors the web writes (`scripts/chart-vectors.ts`, `ChartMathParityTest`).
Data views that are interactive on the web paint read-only here
(`NativeRegistry.readOnly`). Page, document, deck,
card, grid, and deck-slide content layouts are rendered, as are the
composition layouts (stack, row, split, tile) and the code and structure
blocks; app-shell layouts, form controls, chat, the editors and the remaining
components remain visible placeholders. This renderer support does
not promote catalog capability claims: capabilities remain `unknown` until
portable behavior is audited and cross-target conformance is established.
Nothing is published to Maven Central yet: both modules carry their planned
coordinates (`com.texuli`, decision
[ADR-005](../docs/DECISIONS.md#adr-005-maven-coordinates-comtexuli-for-the-native-modules))
and are consumed in place from this repository. To embed the renderer, start
with the [adoption guide](docs/ADOPTION.md).
What paints natively today, component by component and capability by
capability, is the generated [web ↔ native parity matrix](docs/PARITY.md)
(`pnpm exec tsx scripts/native-parity.ts`).
The native slice currently accepts only a documented subset of each compact
chart's props; unsupported options (such as custom formatting, thresholds,
localized labels, and bullet ranges) produce a visible invalid-chart
placeholder rather than being silently ignored. Each chart also exposes a
text summary alongside its graphic.

The native renderer maps page/document/deck titles to named traversal panes,
marks content headings for assistive-technology heading navigation, maps their
declared 1–6 levels to native text styles, and exposes image alternatives,
chart summaries, table cells, lists and boards through Compose semantics.
Lists, tables and boards expose collection positions; wide table/board regions
are focusable and use Compose's direction-aware horizontal layout/scroll
behavior. Compose's shared semantics API marks headings but does not expose
their numeric rank to assistive technology, so rank is currently conveyed
visually only. This widget slice has no live-changing values, live regions or
blueprint-bound interactive controls; the host intent callback receives only
navigate intents, from linked `media-image` nodes. Images are registered as
painted (`IMPLEMENTED`): each paints a frame named by its non-empty `alt`,
with no decoded pixels (see **Media** below).

| Native chart id | Accepted display props |
| --- | --- |
| `charts-sparkline` | `title` or `label`, `description`, `values` (up to 2,000 finite numbers or null gaps), `variant` (`line`, `area`, `bar`), `showLast` |
| `charts-bullet` | `title` or `label`, `description`, `value`, `max`, `target` |
| `charts-gauge` | `title` or `label`, `description`, `value`, `min`, `max` |
| `charts-progress-ring` | `title` or `label`, `description`, `value`, `max` |

The document frame can show a static, non-interactive outline of nested heading
blocks when `toc` is true (the catalog default). A deck frame currently accepts
only `title` and `description` with slides represented as children; other deck
options such as `aspect`, `slides`, `settings` or `masters` show a visible
placeholder. `deck-slide` renders as a titled content section; slide masters,
transitions, theme overrides and speaker notes are not painted. `layout-grid`
bounds the authored column count to 1–4, then reduces it to fit 180dp
minimum-width tiles where possible. Its `gap` accepts only a fixed spacing set
(`0` through `2rem` in quarter-rem steps, or the equivalent named pixel
values); unsupported values produce a visible placeholder rather than
interpreting arbitrary CSS.

**Composition, code and structure (spec 0.8.0;
ADR-016).** `layout-stack`, `layout-row` (wrapping lines of 160dp items, or
one scrolling line with `wrap: false`), `layout-split` (two panes at the
catalog's ratios, stacked below 600dp) and `layout-tile` (a titled card;
its `span` and `rowSpan` are clamped but not yet laid out across grid
columns, planned) paint natively, with only the catalog's closed gap,
align and ratio values. `blocks-code` paints code as inert monospace text
(never highlighted or run); `blocks-structure` paints calls to action (an
`https` href becomes a navigate intent, anything else stays text),
dividers, and `columns` of text, data, code, media and structure blocks
(one level; nested columns are a placeholder). Other structure blocks
(tabs, accordions, cards, grids) stay placeholders.

**Labels (ADR-016).** The renderer's own words (placeholders, the table and
code names) resolve through `TexuliMessages`, the `@texuli/core/i18n`
catalog format with the same ids and `{name}` placeholders (string messages
only; plural and select are planned). Pass one as `BlueprintView(messages =
…)`, or build it from a translation file with `TexuliMessages.fromJson`.
`MessagesParityTest` checks the native interpolation against the web's
shared vectors.

**Media.** `media-image` and the `blocks-media` blocks (`image`, `figure`,
`video`, `gallery`) render natively (`MediaWidgets.kt`):
- **Sources** pass the same untrusted rules as the web. Blocks accept
  `avatar:av-001…175`, base64 `png`/`jpeg`/`webp`/`gif` data URIs up to
  192 KiB, or relative paths, and never remote URLs. `media-image` also
  accepts `https:` URLs without credentials. SVG data, `javascript:`,
  `http:` and anything else become a visible placeholder (`invalid-media`).
- **No pixels are painted.** Common code has no image decoder or network
  fetch, so no source byte is loaded. Each image paints a bordered frame with
  its aspect ratio and alt text, then its caption and credit. A decorative
  image keeps its frame and is hidden from assistive technology. An image with
  alt text is exposed as `Role.Image` named by `alt`, matching the shared
  `media-image` semantic rule.
- **Links:** a `media-image` `href` becomes a navigate intent only when it is
  `https:`.
- **Video** paints its poster frame and states that video playback is not
  available on this target.
- **Galleries** (at most 12 items) fit 140dp tiles, up to the authored 2–4
  columns.
- **Ignored options:** browser loading and cropping hints (`srcset`, `sizes`,
  `widths`, `loading`, `fetchPriority`, `fit`, `focalPoint`, `placeholder`).
- **Still placeholders:** `media-composition-svg` and
  `media-composition-canvas`.
- **Planned:** decoding data-URI images into pixels, a host-supplied image
  loader for `https:` and relative sources, and a conformance golden with
  media (no golden uses a media id yet, so no cross-target trace covers these
  widgets).

**Motion (spec 0.6.0).** The generated decoders read a node's
closed `motion` and the envelope's `motion.level`; anything outside the
vocabulary is refused with `schema`, the same code as TypeScript (the four
`motion-*` invalid fixtures run in `InvalidFixtureParityTest`). The render
plan keeps the checked motion (`PlanNode.Component.motion`), and
`texuli-spec`'s `Motion.kt` maps names to the same token values as the web
(`MotionTokens`: 150, 200 and 300 ms, a fifth of a duration per stagger step,
a 1,000 ms stagger cap, the 0.6 `subtle` scale) with `resolveMotionLevel`
(host, then blueprint, then `full`; reduced motion gives `none`).
`BlueprintView(plan, onIntent, motionLevel)` plays each node's `enter`
preset with Compose `AnimatedVisibility` (fade, slide by 8dp, or scale from
96%, mirrored right to left) when the node first appears, and `layout` as
`animateContentSize`; at `none` it paints the end state. The host passes
`resolveMotionLevel(host, envelope.motion?.level, reducedMotion)`, treating
a system animation scale of 0 as reduced motion. Exit specs are mapped but
have no trigger yet: the native renderer paints a static plan with no `when`
state, so nodes never leave while painted (planned with native state).

**Documents and node keys (spec 0.7.0).** Validation parity, painting
planned. The generated decoders read a node's optional `key`, the
`document` id's `doc` (the `$defs.document` shape: format, version, members)
and the `patchDocument` edit op with its RFC 6902 patch. `SpecValidator`
refuses a malformed key (`schema`), a repeated key (`duplicate-key`) and a
doc over 2,000 top-level blocks (`prop-type`), as TypeScript does; the five
0.7.0 invalid fixtures run in `InvalidFixtureParityTest`, and the
`document-brief` golden's trace (`article`, named by its label) matches the
web trace. The document's own vocabulary (block types, marks, URL policy)
is checked by `@texuli/document` on the web only. The Compose renderer
fails closed: `document` is not in `NativeRegistry`, so it paints a visible
`not-on-this-target` placeholder. Painting documents natively is planned.

**Forms (spec 0.8.0).** Validation of the shape, painting planned. The
generated decoders read the `schema-form` id's `schema` (`$defs.formSchema`
with its fields, options, sections, steps, rules and the closed expression
AST, `$defs.expression`), so unknown members (an agent `pattern`), field
types, formats, autocomplete tokens and expression ops are refused
(`prop-type`), and `PropSchemaValidator` applies the list caps (fields,
sections, steps, rules) as TypeScript does; the four form invalid fixtures
run in `InvalidFixtureParityTest`, and the `form-registration` golden's
trace (`schema-form` as a `form`) matches the web trace. Which members
apply to which field type, ranges, links and the conditions' field
references are checked by `@texuli/forms/model` on the web only, and
evaluating expressions in Kotlin is planned. The Compose renderer fails
closed: `schema-form` is not in `NativeRegistry`, so it paints a visible
`not-on-this-target` placeholder.

**Data-source bindings (spec 0.8.0).** Validation parity,
loading planned. `Source.kt` (`texuli-spec`) checks a
`{"$source": name, "query": {...}, "map": {...}}` prop with the TypeScript
rules: a `sourceable` prop of the catalog, the closed shape, then the host's
source descriptors passed as `loadBlueprint(..., sources = …)` or
`validateBlueprint(..., sources = …)` (`decodeSourceDescriptors` reads
`registry.describe()` JSON); without descriptors every binding is refused
(`source`), and an unregistered name is `unknown-source`. The conformance
suites pass the fixture host (`packages/spec/fixtures/sources.json`), so the
seven `source-*` invalid fixtures and the `source-tickets` golden's trace
match the web. The Compose renderer fails closed: a node that reads a source
paints an `unsupported-source` placeholder (`readsDataSource()`); loading
sources natively is planned.

**Canvases (spec 0.8.0).** Validation parity, painting
planned. The generated decoders read the `canvas` id's `canvas` (the
`$defs.canvas` shape: format, version and members), and
`PropSchemaValidator` applies the grid range and the 5,000-shape and
5,000-connector caps (`prop-type`), as TypeScript does; the two canvas
invalid fixtures run in `InvalidFixtureParityTest`, and the `canvas-retro`
golden's trace (`canvas` as a `figure`, named by its label) matches the web
trace. The closed shape vocabulary, the palette, text safety and the URL
policy are checked by `@texuli/canvas/model` on the web only. The Compose
renderer fails closed: `canvas` is not in `NativeRegistry`, so it paints a
visible `not-on-this-target` placeholder. Painting canvases natively is
planned.

**Sheets (spec 0.8.0).** Validation of the envelope, painting
planned. The generated decoders read the `spreadsheet` id's `sheet`
(`$defs.sheet`: format, version and members), and `PropSchemaValidator`
applies the 1-to-16-tab cap and each tab's row (10,000) and column (256)
ranges, as TypeScript does; the `sheet-format` invalid fixture runs in
`InvalidFixtureParityTest`. Cell inputs, the formula grammar and its closed
function set are checked by `@texuli/sheets/model` on the web only. The
Compose renderer fails closed: `spreadsheet` is not in `NativeRegistry`, so
it paints a visible `not-on-this-target` placeholder. Painting sheets
natively is planned.

**Dashboards (spec 0.8.0).** Validation parity for the props, and both
ids paint natively (PLAN_013, ADR-025). `data-dashboard` and `data-dashboard-widget` are in the
generated vocabulary, so their prop schemas (the closed `layout` places in
grid units, `columns`, `widgetId`) are checked natively as in TypeScript,
and `data-dashboard.layout` is a sourceable prop for the source checks
above. The composition rules `@texuli/catalog` adds (`dashboard-child`,
`dashboard-parent`, `dashboard-widgets`, `dashboard-widget-id`) run in the
catalog's draft validation only; a native check is planned. The Compose
renderer paints both ids read-only with the web's dashboard layout math
(`DataBoards.kt`), and a malformed layout still refuses to the visible
placeholder.

## Modules

| Module | What it holds | Targets |
| --- | --- | --- |
| `texuli-spec` | The generated models, enums and decoders from `packages/spec/generated/kotlin` (compiled in place through `srcDir`, never copied), the generated design tokens (`tokens/DesignTokens.kt`), plus a strict JSON reader, the spec validator (the twin of `validateBlueprint`), the render plan and the semantic trace | JVM, iOS (arm64 and simulator) |
| `texuli-compose` | The token theme (`TexuliTheme`, Material colors from a generated token set), the native registry (translation dictionary, native side), typed host intents (no activate intent) and Compose components: page, doc, deck, card, deck-slide and bounded responsive grid layouts, text blocks and lists, static board diagrams, stat, KPI, accessible table data blocks, stack, row, split and tile layouts, code blocks, calls to action, dividers and columns, image, figure, video and gallery media frames, compact charts, every chart family and every data view (read-only where the web view is interactive), each with a visible placeholder for anything else | JVM (Compose Desktop) |
| `conformance` | The native half of the dual-target golden gate, the validator parity test, design-token value parity and the six KMP app migration checks | JVM tests |

The native flow follows design §4:
1. `loadBlueprint` parses and decodes the blueprint into the generated models.
2. It validates against the spec vocabulary. Invalid structure is refused,
   never repaired.
3. It normalizes the result to a render plan: extension props are dropped,
   and unknown ids become visible placeholders.
4. `BlueprintView` paints the plan under `TexuliTheme` and reports intents
   to the host.

**Targets.** iOS is compiled for `texuli-spec` only, for a SwiftUI adapter
(design decision 3). Android is pending the same decision, and Compose for
the web is not a target, because the web stays Svelte.

## Design tokens (ADR-024)

`TexuliTheme(dark, tokens)` paints with a generated design-token set, not
hardcoded colors. `packages/spec/scripts/design-tokens.ts` compiles design
systems with the web compiler (`@texuli/tokens/design-system/compile`),
resolves every color to sRGB (the gamut-mapped `oklchToHex` the email and
print outputs use) and writes, through `designTokensToKotlin`
(`packages/spec/src/codegen/kotlin-tokens.ts`, internal to the script for
now; a public export is planned):

- `texuli-spec/src/commonMain/kotlin/com/texuli/spec/tokens/DesignTokens.kt`:
  `DesignTokenColors` (29 roles as `0xAARRGGBB`, with `byVar` naming the
  web variable each mirrors), `DesignTokenSet` (id, version, compiled hash,
  font stacks, radius and spacing step in dp, light and dark colors) and
  `DesignTokens.Default` (the Texuli default, `extends: "texuli:violet"`),
  `DesignTokens.Acme` (the spec's `acme.json` fixture) and `all`;
- `conformance/fixtures/design-tokens.web.json`: the web compiler's
  variables for those sets, verbatim.

`texuliColorScheme(tokens, dark)` maps the roles to Material: `primary`,
`primarySoft` (containers), `secondary`, `accent` (tertiary), `background`,
`surface`, `muted` (surface variant), `borderStrong` and `border`
(outlines), `destructive` and `destructiveSoft` (error) and `scrim`, each
with its foreground. A set without a dark mode paints its light colors.
Fonts, radius and spacing are carried for hosts; the Compose components do
not read them yet (planned).

**Value conformance.** `DesignTokensConformanceTest` reads the web JSON,
parses each web string in Kotlin on its own (hex, `rgb()`, and `oklch()`
with the same chroma-reduction gamut mapping) and requires every generated
color to match per channel (±1), and the font stacks, radius and spacing to
be equal. On the web side, `pnpm vitest run packages/spec` fails when the
committed Kotlin or JSON differs from a fresh compile. A brand's own set is
the same script with another document (planned: a CLI command for it).

## The dual-target golden gate

`conformance/semantics.json` holds the target-neutral semantic rules: role,
accessible name and heading level per catalog id or block type. The two
targets apply them to all 15 spec goldens (`packages/spec/fixtures/golden`)
and to the parity fixtures (`conformance/fixtures/parity/`, PLAN_013), which
cover the painted ids no golden uses:

- **Web:** `conformance/web/trace.ts` validates and renders each golden with
  `@texuli/catalog/validate` (untrusted tier) and writes
  `conformance/expected/<golden>.trace.json`. It also generates the Kotlin
  rule table, `SemanticRules.kt`, from the same JSON.
- **Native:** `GoldenConformanceTest` loads each golden with `loadBlueprint`,
  traces the plan, and must equal the web trace.
  `InvalidFixtureParityTest` refuses every spec invalid fixture with exactly
  the TypeScript validator's codes, and `WorkflowFixtureParityTest` does the
  same for the workflow graph fixtures (goldens validate, invalid graphs
  fail with their codes).

This is a semantic gate, not a pixel test.

`KmpStarterMigrationTest` applies the same flow to the first KMP test-bench
app: the KMPStarter screen as a blueprint
(`conformance/fixtures/kmp-starter.json`) must load natively, and each widget
must keep its documented status (painted, visible placeholder, or app code).
The mapping and the gaps it found are in
[docs/kmp-starter-migration.md](docs/kmp-starter-migration.md).

`KmpTodoMigrationTest` applies the same registry-status pin to a static Todo
task-list fixture. The external app remains unchanged; see
[docs/kmp-todo-migration.md](docs/kmp-todo-migration.md) for its mapping and
the controls that remain app code.

`KmpAiChatMigrationTest` does the same for the third app, KMPAIChat. Its
intended chat form (`conformance/fixtures/kmp-aichat-thread.json`, with
`chat-thread` and `chat-message`) validates on both targets now that spec
0.3.0 carries the chat ids (`structure.ts` checks it under the TypeScript
validator too), but there is no native chat painter, so those ids paint a
`not-on-this-target` placeholder. Its fallback
(`conformance/fixtures/kmp-aichat.json`, text blocks in a card) loads with
every widget painted. See
[docs/kmp-aichat-migration.md](docs/kmp-aichat-migration.md).

`KmpVoiceChatMigrationTest` checks the fourth test-bench app, KMPAIVoiceChat.
Its chat and realtime screens, written in the portable vocabulary
(`conformance/fixtures/kmp-voicechat-chat.json` and `kmp-voicechat-realtime.json`),
load natively, and every widget is painted. The transcript in its natural
`chat-thread` / `chat-message` form (`kmp-voicechat-thread.json`) validates
on both targets once the app's roles are mapped (an author per message, the
"assistant" turn as `agent`); the transcript as the app models it is refused
with three pinned diagnostics on both. The chat ids still paint a placeholder
natively. Audio capture and playback, the spinner and every control stay app
code. The details are in
[docs/kmp-voicechat-migration.md](docs/kmp-voicechat-migration.md).

`KmpPttDynamicsMigrationTest` applies that check to fictional static snapshots
of the flagship room's chat, polls, hand-raise, raffle, and trivia areas. The
external app remains unchanged; see
[docs/kmp-pttdynamics-migration.md](docs/kmp-pttdynamics-migration.md) for
the current native statuses and the live-flow/audio gaps.

`KmpTapDuelMigrationTest` closes the set with the sixth app, KMPTapDuelGame.
A finished match as a static scoreboard (`conformance/fixtures/kmp-tapduel.json`:
stat row, progress ring, winner callout) loads with every widget painted. The
tap zones (`conformance/fixtures/kmp-tapduel-arena.json`) load as `tier-denied`
placeholders, and the portable profile refuses the scoreboard with
`unsupported-profile` for each id. The game loop stays app code; see
[docs/kmp-tapduel-migration.md](docs/kmp-tapduel-migration.md).

After the spec added named child slots and `when` conditions, the expected web
traces were refreshed from every golden. The conditional report trace uses
explicit fictional host inputs (`closed: 38`, `blocked: 2`) so its conditional
node is visible on both targets. The native validator also checks that named
slots exist on the parent, matching the shared spec validator; default
`children` remains valid and slots under an unknown parent are not judged.

## Checks that run now (no JDK needed)

```bash
pnpm exec tsx native/conformance/web/trace.ts       # the web traces and SemanticRules.kt are current
pnpm exec tsx native/conformance/web/structure.ts   # wrapper, modules, packages, brackets, imports, trace parity
pnpm vitest run packages/spec                       # the spec harness: generated Kotlin structure and closed decoding
pnpm exec tsx packages/spec/scripts/design-tokens.ts --check  # DesignTokens.kt and the web token JSON are current
pnpm exec tsx scripts/chart-vectors.ts --check      # the chart and data vectors and PortMeridian.kt are current
pnpm exec tsx scripts/native-parity.ts --check      # the parity matrix is current and every painted id is covered
```

### Native test map

Every Kotlin suite, what it pins, and where it runs. `./gradlew check` runs all
of them; the `texuli-spec` and `texuli-compose` suites are common code, so they
run on the JVM and (for `texuli-spec`) the iOS simulator as well.

| Suite | Module | What it pins |
| --- | --- | --- |
| `JsonReaderTest` | `texuli-spec` | Strict JSON: every type, refusals of non-JSON, depth bombs and oversized text |
| `SpecValidatorTest` | `texuli-spec` | `validateBlueprint` reports the TypeScript validator's codes, fails the portable profile closed, judges named slots; spec 0.3.0 state, bindings, `bind`, `on` actions, property schemas and `deprecated` warnings with the TypeScript codes and paths |
| `WorkflowValidatorTest` | `texuli-spec` | Workflow graph rules (ids, types, fields, ports, multiplicity, kinds, cycles), label control and bidi refusals, and the 500-node / 2,000-edge limits |
| `MotionTest` | `texuli-spec` | Spec 0.6.0 motion: closed decoding into the plan, `schema` refusals of CSS, milliseconds, unknown names and a huge stagger, level precedence, `subtle`, and the stagger cap |
| `RenderPlanTest` | `texuli-spec` | The render plan's tier gate: ids whose catalog `emit` list lacks the tier become `tier-denied` placeholders (default tier `untrusted`), checked for every catalog id |
| `SourceTest` | `texuli-spec` | Spec 0.8.0 data-source bindings: a valid binding passes with the host's sources and fails closed without them, the TypeScript refusals (unknown source, a URL name, extra members, page size, fields, sort, operators, values, map, mixed keys, nested bindings), a 10,000-level filter, descriptor decoding and bound plan nodes |
| `AccessibilityTest` | `texuli-compose` | Image alternatives (blank alt is decorative) and heading ranks clamped to 1-6 |
| `ChartWidgetsTest` | `texuli-compose` | Compact chart props: gaps, variants, title-over-label naming, bounded scales, refusals |
| `ChartMathParityTest` (jvmTest) | `texuli-compose` | Every case in `conformance/fixtures/chart-vectors.json` (written by `scripts/chart-vectors.ts` from the web's chart and data functions): numbers to 1e-9, SVG paths and labels exactly; a perturbed vector fails |
| `CartesianChartsTest`, `PartWholeChartsTest`, `MatrixFlowChartsTest`, `GeoChartsTest` | `texuli-compose` | Each chart family's projection, refusal where the web's layout throws, its scene and table, and the hostile matrix |
| `DataTablesTest`, `DataTimeTest`, `DataBoardsTest` | `texuli-compose` | Each data view's projection and the web's ordering, date and layout rules as the views use them, https-only inbox intents, named time zones refused, and the hostile matrix |
| `LayoutWidgetsTest` | `texuli-compose` | Responsive grid columns, gap mapping, document outline order, deck-slide labels |
| `ListBoardTest` | `texuli-compose` | List ordering and board columns/cards, with column, card and unique-id caps |
| `MediaWidgetsTest` | `texuli-compose` | Untrusted media source rules, `media-image` and `blocks-media` projections, gallery columns |
| `MotionTest` (compose) | `texuli-compose` | Every motion preset maps to Compose enter and exit transitions in both directions; absent presets and level `none` play nothing |
| `CompositionWidgetsTest` | `texuli-compose` | Stack, row, split and tile props (closed gaps, aligns and ratios, clamped spans), inert code blocks with a size cap, https-only call-to-action hrefs, columns and dividers, the nested-block families, and the hostile matrix on every new projection |
| `TexuliThemeTest` | `texuli-compose` | `TexuliTheme`'s Material scheme reads the generated token set in light and dark; a brand set changes it |
| `MessagesTest` | `texuli-compose` | `TexuliMessages`: one-pass `{name}` interpolation, catalog lookups with English defaults, untrusted catalog JSON, linear time on runs of braces |
| `TableGridTest` | `texuli-compose` | Table column/row normalization, inert cells, bounded grid columns and rows |
| `HostilePropsTest` | `texuli-compose` | The hostile matrix: every projection's props replaced by each value in `HOSTILE_VALUES` (wrong types, JSON null, non-finite and extreme numbers, huge, bidi, zero-width, control and surrogate strings, huge and deep containers) never throws and stays in bounds |
| `GoldenConformanceTest` | `conformance` | Each spec golden's native trace equals the web trace; prints native coverage per id |
| `ParityFixtureConformanceTest` | `conformance` | Each parity fixture (`conformance/fixtures/parity/`, ids no spec golden uses) traces as on the web, and names only painted ids |
| `MessagesParityTest` | `conformance` | Native label interpolation equals `@texuli/core/i18n` on the shared vectors (`packages/core/tests/fixtures/i18n-vectors.json`), and every composition layout the spec goldens use paints natively |
| `InvalidFixtureParityTest` | `conformance` | Every spec invalid fixture is refused with exactly the TypeScript codes |
| `WorkflowFixtureParityTest` | `conformance` | Every spec workflow golden validates and every workflow invalid fixture is refused with exactly the TypeScript codes |
| `DesignSystemFixtureTest` | `conformance` | The spec's design-system fixtures (spec `0.10.0`) decode with the generated `DesignSystem` types across every section, kebab-case component keys as camelCase properties; an unknown key fails closed. Types only: the TypeScript validator checks patterns and caps |
| `BlueprintDesignSystemTest` | `conformance` | Spec `0.10.0`: the `brand-report` and `brand-deck` goldens carry `designSystem` as a `ref` and as an `inline` document; both decode and load, the inline document decodes with `DesignSystem.decode`, and a range, a URL, both keys or neither are refused with `schema` (`checkDesignSystem` in `SpecValidator.kt`), as in TypeScript |
| `DesignTokensConformanceTest` | `conformance` | Every generated design-token color equals the web compiler's variable, parsed independently in Kotlin (hex, `rgb()`, gamut-mapped `oklch()`), per role and mode for the default and acme sets; fonts, radius and spacing equal |
| `KmpStarterMigrationTest` | `conformance` | The KMPStarter blueprint loads natively and each widget keeps its documented status |
| `KmpTodoMigrationTest` | `conformance` | The KMPTodoApp screen as a static fixture: registry statuses pinned, external app untouched |
| `KmpAiChatMigrationTest` | `conformance` | The KMPAIChat screen: the chat form validates and plans (no native chat painter yet), the fallback loads painted |
| `KmpVoiceChatMigrationTest` | `conformance` | Both KMPAIVoiceChat screens load; the `chat-thread` form validates with roles mapped, the unmapped transcript is refused with three pinned diagnostics |
| `KmpPttDynamicsMigrationTest` | `conformance` | Five fictional flagship-room snapshots load; controls and audio stay app code |
| `KmpTapDuelMigrationTest` | `conformance` | A KMPTapDuelGame scoreboard snapshot loads painted; tap zones are `tier-denied`; the portable profile refuses it |

The widget suites build props with the shared fixtures in
`texuli-compose/src/commonTest/kotlin/com/texuli/compose/Fixtures.kt` (JSON and
blueprint builders, `HOSTILE_VALUES`, `hostileVariants`). Board diagrams are
display-only; drag/drop and other editing behavior remain unsupported.

The tier gate is a render-time policy on both targets: `validateBlueprint`,
like its TypeScript twin, checks structure only and never reads `emit`, and
the envelope's declared `tier` is display data. The host picks the tier
(`loadBlueprint(..., tier = ...)`); the default is `untrusted`, as on the web.

These tests cover deterministic projections. They do not inspect the emitted
Compose semantics tree or exercise live-region speech, host-interactive
controls or device-specific TalkBack/VoiceOver output. A Compose UI-test run
was attempted, but it stalled during macOS AWT/AppKit initialization before
assertions executed; no Desktop UI-test suite is wired, and screenshot tests
are not wired either. A lane-local scratch Gradle and Kotlin/Native home is
required (see [Building](#building)); to run only the widget suites:

```bash
cd native
JAVA_HOME="/path/to/jdk-21" \
  GRADLE_USER_HOME="../tmp/gradle-home" \
  KONAN_DATA_DIR="../tmp/gradle-home/konan" \
  ./gradlew :texuli-compose:allTests
```

The conformance JVM tests cover native blueprint loading, semantic traces,
invalid-fixture parity, and KMP app migration fixtures; they do not launch the
external KMP apps. `structure.ts` also simulates the native plan in TypeScript
(spec validation, then portable props only) and checks that it reproduces the
web traces, so the traces do not depend on the renderer. That is a simulation,
not a Kotlin run.

## Building

With JDK 21 and network access to resolve the pinned Gradle/Kotlin/Compose
artifacts, or with a populated lane-local Gradle cache:

```bash
cd native
JAVA_HOME="/path/to/jdk-21" \
  GRADLE_USER_HOME="../tmp/gradle-home" \
  KONAN_DATA_DIR="../tmp/gradle-home/konan" \
  ./gradlew check
```

The default JDK 26 on this host is rejected by Kotlin's version parser
(`IllegalArgumentException: 26`); select JDK 21 explicitly. For example, from
the repository lane root, build with:

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 21) \
  GRADLE_USER_HOME="$PWD/tmp/gradle-home" \
  KONAN_DATA_DIR="$PWD/tmp/gradle-home/konan" \
  ./native/gradlew -p native check
```

The scratch locations are lane-local and must not use the machine's default
Gradle or Kotlin/Native caches. The aggregate `check` task passed on JDK 21
after the four-golden and invalid-slot parity refresh. The iOS simulator test
task printed an authorization warning while installing its test package, but
Gradle completed the aggregate task successfully.

### Build health baseline (2026-10-25)

Measured on macOS 27 (arm64), Eclipse Temurin JDK 21.0.10, Gradle wrapper
8.14.3, Kotlin Multiplatform 2.3.20 and Compose Multiplatform 1.10.3. The
version-catalog pins are the current design-decision-5 values; this audit did
not change them. Commands ran offline with a lane-local `GRADLE_USER_HOME` and
`KONAN_DATA_DIR`, seeded from the existing local cache. The seed was cache-warm,
so these numbers are clean-task timings with reusable outputs available, not a
cold dependency-resolution baseline:

| Command | Result |
| --- | --- |
| `./native/gradlew -p native --offline --no-daemon --console=plain --info clean check` | `BUILD SUCCESSFUL`, 38.99 s; 33 actionable tasks: 20 executed, 11 `FROM-CACHE`, 2 `UP-TO-DATE` |
| Repeat `./native/gradlew -p native --offline --no-daemon --console=plain clean check` | `BUILD SUCCESSFUL`, 53.61 s; 33 actionable tasks: 22 executed, 11 `FROM-CACHE` |
| Following warm `./native/gradlew -p native --offline --no-daemon --console=plain check` | `BUILD SUCCESSFUL`, 38.95 s; 26 actionable tasks: 3 executed, 23 `UP-TO-DATE` |

The first clean run restored 11 tasks from the local build cache, including
JVM and iOS-spec Kotlin compilation, Kotlin test compilation/execution and the
iOS simulator test link. `11 / 33` is the observed share of actionable task
outcomes restored from cache, not a cache hit rate among cache-eligible tasks:
the denominator also includes cleanup, resource-copy, and other tasks Gradle
reports as non-cacheable. `--info` identified clean/delete tasks as
non-cacheable by design, Kotlin/Native distribution download as
location-dependent, KMP dependency checkers as not intended for execution,
small JAR/resource-copy tasks as not worth caching, aggregate `allTests` tasks
as cache-disabled, and the iOS simulator test runner as cache-disabled. The
JVM and Kotlin/Native compile/link/test tasks did restore cache entries. No
remote cache or build scan was used; this offline audit has no remote hit-rate
measurement.

For a same-input repeat check, SHA-256 hashes matched before and after the
second clean build for all three JVM JARs and the iOS simulator test executable
and its debug-symbol binary. This demonstrates identical outputs in this
cache-seeded lane on this host; it does not establish cross-host or
cache-independent reproducibility. No dependency lock state or Gradle
dependency-verification metadata is checked in under `native/gradle/` today.

The configured target graph is narrow: `texuli-spec` has JVM, iOS arm64 and
iOS simulator arm64 targets; `texuli-compose` and `conformance` have JVM only.
The root `check` task reaches JVM tests in all three modules and the iOS-spec
compile/link/test tasks. There is no Android or Compose iOS target in the
current graph. `org.gradle.caching=true` enables the local task-output cache;
configuration cache is not enabled. The wrapper pins Gradle 8.14.3 and
validates its distribution URL. Gradle started a JDK 21 daemon successfully;
the build's JDK 21 toolchain is explicit in each module. `help` passed, and
`--status` showed one lane-local Gradle 8.14.3 daemon as `IDLE`. The iOS
simulator task returned successfully but printed two package-install
authorization warnings; that warning remains a host limitation to investigate.
For daemon health checks, use `./native/gradlew -p native --status` with the
same isolated home.

When an existing Gradle home is cloned into a lane, do not reuse its `daemon/`
registry: it can point to a daemon launched from the source home. Start the
clone with a fresh daemon registry so the daemon and build-cache paths both
stay inside the lane. A cold build-cache run, cross-platform repeat, and CI
timing baseline remain unmeasured. Enabling configuration cache or adding
dependency locking/verification should be evaluated separately before changing
the native build policy. These are owner decisions; no new plugins, lock state,
verification metadata or configuration-cache settings were added here.

The proposed pins are in `gradle/libs.versions.toml`: Kotlin 2.3.20 and
Compose Multiplatform 1.10.3. Ratifying them is design decision 5.

## Regenerating

- The spec's Kotlin comes from `pnpm exec tsx packages/spec/scripts/generate.ts`.
- The design tokens come from
  `pnpm exec tsx packages/spec/scripts/design-tokens.ts`; rerun it when the
  compiler, a library theme or the acme fixture changes (the hash moves).
- After a golden or a semantic rule changes, run
  `pnpm exec tsx native/conformance/web/trace.ts --write` and review the diff.
- The generated Kotlin carries the spec version and digest in its stamp. A
  spec change moves both; the version rules, and what a change means for a
  native build, are in the spec's
  [Versioning](../packages/spec/README.md#versioning) section. A new invalid
  fixture is picked up by `InvalidFixtureParityTest` without a code change.
  A new golden also needs its web trace and the golden count in
  `GoldenConformanceTest`.

---

Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-native).
