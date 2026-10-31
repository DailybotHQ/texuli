# The design-system compiler (`@texuli/tokens/design-system/compile` and `/validate`)

> **Status: in development for `0.10.0`, not on npm.** Both subpaths exist on
> the `release/0.10.0` branch and ship only with `@texuli/tokens@0.10.0`. The
> runtime is [design-system-runtime.md](design-system-runtime.md); the
> importers, emitters, report, diff and fixtures are built on the same branch
> ([design-system-io.md](design-system-io.md)), and so is `texuli ds check`
> ([ds-check.md](../../tools/docs/ds-check.md)). The MCP `ds.*` operations
> are **planned** (a later PLAN_011 task).

The compiler turns a design-system document
([`@texuli/spec/design-system`](../../spec/docs/design-system.md), ADR-021)
into concrete `--tx-*` variables per mode, and enforces the guarantees of
[ADR-022](../../../docs/DECISIONS.md#adr-022-design-system-guarantees-enforced-never-reported):
text contrast at the declared target, focus rings at 3:1 and at least 2 px
wide, and interactive targets at `accessibility.targetMin`. It is pure,
synchronous and deterministic. A failing document returns
`{ ok: false, errors }` with stable codes and JSON paths; it never throws.

Both subpaths are lazy. The `@texuli/tokens` root never imports them (a test
walks the root's import graph), so `base.css` and the root stay the same
size, and an app that never compiles a design system pays nothing.

```ts
import { compileDesignSystem, resolveDesignSystem } from '@texuli/tokens/design-system/compile';

// `extends: "texuli:violet"` loads the library theme in a lazy chunk (never the network);
// `id@x.y.z` bases come from your resolver.
const resolved = await resolveDesignSystem(doc, { resolve: (ref) => savedDocuments.get(ref) });
if (!resolved.ok) throw new Error(resolved.errors[0]?.message);

const compiled = compileDesignSystem(resolved.document, { variant: 'compact' });
if (compiled.ok) {
  compiled.vars.light; // { '--tx-background': '#ffffff', '--tx-space-4': '1rem', … } concrete, sorted
  compiled.attrs; // { 'data-tx-ds': 'acme', 'data-tx-surface': 'glass', … }
  compiled.report.adjustments; // every color or size the solver chose
} else {
  compiled.errors; // [{ code: 'aa-text', path: '$.color.roles.light.foreground', pairs: [...] }]
}
```

## API

| Export | What it does |
| --- | --- |
| `compileDesignSystem(doc, { modes?, variant?, patches?, resolve?, trust? })` | Synchronous. Validates (the spec's validator at `trust`, `untrusted` by default), resolves `extends` through `resolve`, applies the variant then the patches, and compiles. Returns `CompiledDesignSystem` (`ok: true`) or `{ ok: false, errors }` |
| `resolveDesignSystem(doc, { resolve?, variant?, patches?, trust? })` | Asynchronous: loads `texuli:<id>` from the theme library (lazy chunks) and awaits `resolve` for `id@x.y.z`. Returns `{ ok, document, chain, variant?, hash }`: the merged document without `extends` |
| `resolveDesignSystemSync(doc, options)` | The same with a synchronous `resolve`, which may return a `Theme` (or a document) for `texuli:<id>` |
| `loadLibraryBase('texuli:<id>')` | One library theme as a document whose `color.brand` is the theme's generator input |
| `fromTheme(theme, { id?, version?, brand? })` · `fromThemeWithReport` | Any Texuli `Theme` as a valid document (see below); the report lists fields the closed vocabulary cannot carry |
| `checkDesignSystemGuarantees(compiled)` | Re-checks a compiled (or cached) variable map: contrast pairs, focus width and targets, with `aa-text`, `aa-focus` and `target-size` and `$.vars.<mode>["--tx-…"]` paths. Also on `/validate` |
| `evaluateDesignSystemContrast(vars, contrast)` | Every pair of `DESIGN_SYSTEM_PAIRS` with its ratio and requirement |
| `DESIGN_SYSTEM_ATTRIBUTES` | The allowlist of `attrs` keys: `data-tx-ds`, `data-tx-ds-version`, `data-tx-ds-variant`, `data-tx-surface`, `data-tx-elevation`, `data-tx-focus-ring-style`, `data-tx-icon-style` |
| `canonicalJson`, `sha256Hex` | The hash's canonical form (keys sorted at every depth) and a synchronous SHA-256 |

`@texuli/tokens/design-system/validate` re-exports the spec's
`validateDesignSystem`, `validateDesignSystemPatch`, `applyDesignSystemPatch`,
`migrateDesignSystem`, `checkDesignSystemReference` and constants, plus
`checkDesignSystemGuarantees`, `evaluateDesignSystemContrast`,
`DESIGN_SYSTEM_ATTRIBUTES`, `DESIGN_SYSTEM_PAIRS` and `DESIGN_SYSTEM_TARGETS`,
without the compiler or the color engine.

## `CompiledDesignSystem`

| Field | Content |
| --- | --- |
| `vars[mode]` | A flat, key-sorted map of `--tx-*` names to concrete strings (no `var()`, no `url()`), for each compiled mode: every semantic role and its interaction states, every style variable `themeVariables` writes, every system token of contract v2 (space, size, type roles, elevation, shape, layers, opacity, layout, icons, status), the motion durations, easings and springs, the 28 data-viz tokens (always emitted for design systems), and only the component tokens the document sets. The acme fixture compiles to 310 variables per mode |
| `attrs` | The allowlisted attributes, mode-independent |
| `fontFaces` | One entry per `typography.families.*.files[]`: `family` (the stack's first name), `src`, `format`, `weight`, `style`, `display`, `inline`, and a `preload` hint (`{ href, as: 'font', type, crossorigin: 'anonymous' }`) for same-origin files marked `preload` |
| `assets` | `logo.{light,dark,mark,wordmark}` and `favicon`, as validated |
| `defaults` | Component defaults (`{ button: { variant, size } }`) for `setDesignDefaults` |
| `accessibility` | `{ contrast, targetMin }`: what the guarantees were held to |
| `report` | `contrast[mode]` (every checked pair with its ratio), `adjustments` (mode, variable, from, to, the field that caused it, why), `warnings`, `inlineBytes` (decoded bytes of every `data:` font and asset) and `targets` |
| `hash` | SHA-256 of the canonical resolved document, the variant, the modes, the trust level and `DESIGN_SYSTEM_COMPILER_VERSION`; key order never changes it |

## Resolution: `extends`, variants, patches

- `extends: "texuli:<id>"` is a library theme as a document: its generator
  input (seed, secondary, neutral, contrast level) goes to `color.brand` and
  its style knobs to their sections, so a child that changes the seed
  regenerates the palette. `extends: "id@x.y.z"` comes from your resolver
  and must declare that exact id and version.
- The chain is followed nearest first: a return to a document already seen
  is `extends-cycle`, more than 4 hops is `extends-depth`, a range is
  `extends-range` (from the spec's validator), and a reference nothing
  resolves is `invalid-value` at `$.extends` with a hint. Each base is
  migrated and validated; its issues carry `source: "<ref>"`.
- Sections merge with the spec's `applyDesignSystemPatch` (objects merge,
  arrays replace, `null` removes): the deepest base first, then each
  document up the chain, then `variant` (a key of `variants`), then each
  patch in order. Precedence is override > variant > extends. Identity
  fields come from the top document. A variant or patch that leaves the
  document invalid is refused with `source: "variant:<name>"` or
  `"patch:<i>"`.
- Variants are orthogonal to mode: every variant compiles for every mode.

## Color: the generator, pins and the solver

1. `color.brand` (`seed`, `secondary`, `neutral`) goes through
   `generateThemeFromSeed` at the declared contrast (`AA` 4.5:1 or `AAA`
   7:1 text). With no brand, the seed is the `violet` library seed
   (`#7c3aed`). `brand.accent` sets the hue of the third data-viz series.
2. **Brand pins** (`color.pin.*`) are kept exactly as the fill (and
   `primary` also as `sidebarPrimary`). When a pin differs from the
   generated fill, the solver picks its on-color (white or near-black, then
   pure black) and re-derives its soft tint and ink around the pin's hue.
3. **Role pins** (`color.roles.<mode>.*`) override both and are never
   moved.
4. The solver checks `THEME_CONTRAST_PAIRS` (text at the target; strong
   borders, inputs and the focus ring at 3:1) and moves only colors no pin
   holds: the foreground first, else the background, along its own hue
   and chroma, until every pair it belongs to passes. Interaction states
   (hover, active, disabled, focus) are re-derived with the generator's
   rule whenever a fill or its context changed.
5. `color.status.*` sets the status fills; a status on-color that fails is
   replaced by a readable one. `color.dataViz.<mode>` sets the chart
   palette; without it, the palette is derived from the solved colors (as
   `dataVizVariables` does), and a palette that sets only some lists takes
   the rest from the derived one. `cvdSafe: true` reports color-vision
   conflicts of a derived palette as warnings.

Every move is in `report.adjustments` with the field that caused it. A pair
that still fails involves only pins; it is refused as `aa-text` (or
`aa-focus` for the ring) with the pair, its ratio, the mode and every pinned
path in `hint`. Translucent colors are composited over their background
before a ratio is taken; `oklch()` pins are gamut-mapped for the math and
emitted as written.

## The rest of the document

| Section | Variables |
| --- | --- |
| `typography` | `--tx-font-sans`, `--tx-font-heading`, `--tx-font-mono` (names that are not CSS identifiers are double-quoted); the 13 `--tx-font-size-*` steps from `scale.ratio` and `scale.base`; role fields to `--tx-type-<role>-*`, except the anchors `body.weight`, `label.weight`, `heading.weight`, `display.weight`, `body.tracking` and `heading.tracking`, which set `--tx-font-weight-{body,medium,heading,bold}` and `--tx-letter-spacing-{body,heading}` |
| `shape` | `--tx-radius` (px to rem), `--tx-radius-scale` and its steps, `--tx-border-width` |
| `space` | `--tx-density`, `--tx-space-unit` and `--tx-space-1…12` (`base` × density) |
| `elevation`, `surface` | `--tx-elevation-style`, the soft and float shadows and `--tx-elevation-0…5`; `--tx-surface-style`, `--tx-glass-opacity`, `--tx-glass-blur` |
| `motion` | `personality` picks a motion preset (none, subtle, standard, expressive) for `--tx-motion-fast/base/slow/slower` and `--tx-motion-easing`; `durations` and a named `easing` override it; the duration, easing and spring tokens follow (`none` makes them `0ms` and `linear`) |
| `layout`, `icons` | Content and wide widths, breakpoints, grid columns and gutters; icon stroke, style and sizes |
| `components` | Each set token becomes `--tx-<component>-<key>`, resolved through the system token it names (`radius: "full"` → `9999px`). A test sets every registry token to the step its default reads and checks the compiled value equals that default |
| `accessibility` | `--tx-focus-ring-{style,width,offset}`, `--tx-size-target-min` |

**Targets.** The system control heights are lifted to `targetMin` when it
is larger (reported as adjustments). A component size the document pins
(`button.height-md: "icon-sm"`) that falls below `targetMin` is refused as
`target-size` at its path. **Focus.** `accessibility.focusWidth` below 2 px
is refused as `aa-focus`.

## `fromTheme`: the zero-drift bridge

`fromTheme(theme)` turns any `Theme` into a valid document: `color.brand`
from the theme's generator input when given (`brand`), else its light
primary; every role whose value the generator would not reproduce becomes
a role pin; fonts, radius, density, elevation, surface, motion, focus and
charts go to their sections. A test compiles all 210 library themes, both
as `fromTheme(theme)` and as `texuli:<id>`, and checks that every variable
`themeVariables(theme)` writes is equal in the compiled map (after resolving
the two shadow values' own `var(--tx-shadow)` reads, since compiled values
are concrete). Interaction states are re-derived from each role's default,
so a hand-made theme with custom states, a radius over 48 px, an unnamed
easing or component hooks loses those fields; `fromThemeWithReport` lists
them.

## Codes

The spec's codes (`unknown-key`, `invalid-type`, `invalid-value`,
`required`, `format-version`, `extends-range`, `extends-cycle`,
`extends-depth`, `url-refused`, `inline-bytes`) plus the guarantees:

| Code | When |
| --- | --- |
| `aa-text` | A text pair below the target, or a strong border or input below 3:1, that only pins can fix |
| `aa-focus` | The focus ring below 3:1 against the page or surface, or narrower than 2 px |
| `target-size` | A pinned interactive size below `accessibility.targetMin` |

## Size and speed

Measured with `pnpm size --filter tokens` (gzip, 2026-10-30):
`design-system/compile` 30,780 B (library themes in lazy chunks, 21.9 KB,
load only for `texuli:<id>`), `design-system/validate` 9,850 B (the spec's
validator is 7.1 KB of it). The `@texuli/tokens` root measured 40,845 B
before this change and 40,820 B after; `base.css` is byte-identical.
`pnpm test:perf` holds compiling acme for light and dark to 25 ms; it
measured about 4 ms on an Apple silicon laptop.
