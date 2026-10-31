# Design-system importers, emitters, report and diff

> **Status: in development for `0.10.0`, not on npm.** The subpaths
> `design-system/import`, `design-system/emit`, `design-system/report`,
> `design-system/diff` and `design-system/fixtures` exist on the
> `release/0.10.0` branch and ship only with `@texuli/tokens@0.10.0`. The
> Kotlin, email, PDF, DOCX, PPTX and canvas outputs, `texuli ds import |
> export | diff` and the MCP `ds.*` operations that call these are
> **planned** (later PLAN_011 tasks).

These subpaths move a design system
([the document](../../spec/docs/design-system.md),
[the compiler](design-system-compiler.md)) in and out of the formats a
company already has. Everything is pure, synchronous and deterministic: the
same input, in any key order, gives byte-equal output. All five are lazy;
the `@texuli/tokens` root never imports them.

```ts
import { importDtcg, importBrand } from '@texuli/tokens/design-system/import';
import { compileDesignSystem } from '@texuli/tokens/design-system/compile';
import { emitCss, emitDtcgJson } from '@texuli/tokens/design-system/emit';
import { emitReportHtml } from '@texuli/tokens/design-system/report';
import { diffDesignSystems } from '@texuli/tokens/design-system/diff';

const result = importDtcg(fileText); // or importBrand('brand #4f46e5, font Inter, rounded, compact')
if (!result.ok) console.log(result.errors); // [{ code: 'invalid-input' | 'input-limit' | spec codes, path, message }]
else {
  result.warnings; // [{ code: 'unmapped', path: '$.color.hover', message }]
  const compiled = compileDesignSystem(result.document);
  if (compiled.ok) {
    emitCss(compiled); // [data-tx-ds="acme"] { … } and .dark rules
    emitReportHtml(compiled); // a static review page
  }
}
```

## Why five subpaths

| Subpath | Loaded by | Size (gzip) |
| --- | --- | --- |
| `design-system/import` | the studio, the CLI, the MCP | 26,026 B (every importer validates its result, so the spec's 7 KB validator is in each; named imports tree-shake: `importDtcg` alone is about 12.5 KB, `importLogoPixels` 9.8 KB, `importTheme` 17.8 KB) |
| `design-system/emit` | builds, the studio, the CLI | 4,126 B |
| `design-system/report` | PR review, the CLI | 4,432 B (the only module that writes HTML) |
| `design-system/diff` | the CLI, the MCP, PR review | 3,394 B |
| `design-system/fixtures` | tests (Texuli's and adopters') | 2,693 B |

Measured with `pnpm size --filter tokens` on 2026-10-30; the `@texuli/tokens`
root stayed at 40,820 B. Each consumer loads only what it uses, and the
fixtures never reach an app.

## Importers (`design-system/import`)

Every importer returns `{ ok: true, document, warnings }` with a valid
document (checked by `validateDesignSystem` at `trust: 'untrusted'` unless
you pass `trust: 'developer'`), or `{ ok: false, errors, warnings }`. **They
never throw**, whatever the input.

| Export | Reads |
| --- | --- |
| `importBrand(text, options?)` | A brand one-liner, clauses split by `,`, `;` or new lines: `brand\|seed\|primary <color>`, `secondary <color>`, `accent <color>`, bare colors (seed, then secondary, then accent), `neutral <family>`, `font\|sans <name>`, `heading [font] <name>`, `mono [font] <name>`, `serif <name>`, `name <text>`, `id <id>`, `radius <px\|rem>`, `sharp` (0), `slightly rounded` (4), `rounded` (12), `pill` (20), `dense` (0.75), `compact` (0.875), `comfortable` (1), `spacious` (1.125), `flat\|soft\|crisp\|glow\|layered`, `glass\|solid`, `calm`, `<word> motion`, `motion <word>`, `focus <ring\|outline\|glow\|inset>`, `AA`, `AAA` |
| `importDtcg(input, options?)` | A W3C DTCG file (object or JSON text): `$value`, inherited `$type`, `{a.b}` aliases, string colors and 2025.10 color objects (`hex`, `srgb` or `oklch` components), dimensions as `8px`, `0.5rem` or `{ value, unit }`, durations as `120ms`, `0.12s` or `{ value, unit }` |
| `importTokensStudio(input, options?)` | A Tokens Studio file: sets in `$metadata.tokenSetOrder` (else every root object), legacy `value`/`type` or `$value`/`$type`; sets named `light` or `dark` (or ending in `/light`, `-dark`) give their tokens a mode; later sets win |
| `importRolePalette(input, options?)` | A flat role palette (`RolePalette`): `light` and `dark` role maps (camelCase, kebab-case, `--tx-` optional, `card`/`popover` read as `surface`/`elevated`), `fontFamily`, `fontFamilyHeading`, `fontFamilyMono`, `radius`, `density`, `style.{surface,focusRing,elevation,motion}`, `charts.{light,dark}`, optional `seed` (else `light.primary`) |
| `importTheme(input, options?)` | A Texuli `Theme`, validated by `validateTheme`, through `fromThemeWithReport`; what the document cannot carry is a `lossy` warning |
| `importLogoPixels({ data }, options?)` | RGBA pixels (`ImageData`, a typed array or a list): `dominantColors` over an even sample of at most 20,000 pixels, then `seedsFromColors`. Returns `palette` (the dominant colors) next to the document. The same pixels give the same result, whatever array holds them |

`options`: `trust`, `id`, `version`, `name` (override what the input says)
and `maxBytes` (the JSON text cap, 1 MiB by default).

### DTCG and Tokens Studio layout

A token's path is its document path (`color.roles.light.primary`,
`typography.roles.body.size`, `motion.durations.fast`), and the data-viz
lists are 1-based groups (`color.dataViz.light.categorical.1`). Only design
values are tokens: colors, px dimensions, numbers, font weights, durations
and font stacks. Everything else (identity, enums such as `elevation.style`,
components, assets, voice, variants) travels as a partial document in the
root `$extensions["com.texuli.design-system"]`, which is what makes
document → file → document lossless.

A foreign file (any other layout) is mapped by name: a semantic role under a
`light` or `dark` group or set becomes a role pin (`light.primary-foreground`
→ `color.roles.light.primaryForeground`; without a mode, light), `brand` or
`seed` the brand seed, a font family by its role (`body` → `sans`,
`display` → `heading`, `code` → `mono`), a radius token `shape.radius`.
Everything else is an `unmapped` warning naming the token's path.

### Codes

| Code | Kind | When |
| --- | --- | --- |
| `invalid-input` | error | Not JSON, not the expected shape, an invalid `Theme`, pixels with no opaque pixel, or a getter that threw |
| `input-limit` | error | Text over `maxBytes`, more than 50,000 values, a one-liner over 1,000 characters or 32 clauses, more than 4096 × 4096 pixels |
| the spec's codes | error | The assembled document still fails validation after every optional value was tried (identity or a future `formatVersion`) |
| `unmapped` | warning | A key, token or clause no document field takes |
| `unsafe-value` | warning | A value refused for CSS injection, markup, or control, bidi or zero-width characters |
| `invalid-value` | warning | A value of the wrong type or form, or one the validator refused (the spec's code is in the message); it is dropped and validation runs again |
| `reserved-key` | warning | `__proto__`, `constructor` or `prototype`: never read |
| `alias` | warning | An alias that names nothing, a cycle, a chain over 16, or embedded references and math |
| `limit` | warning | Nesting over 32 levels or a string over 4,096 characters, cut |
| `default` | warning | No brand color anywhere: the seed is `#7c3aed` |
| `lossy` | warning | `importTheme`: a `Theme` field the closed vocabulary cannot carry |

### Hostile input

The tests feed every parser wrong types (`null`, numbers, functions,
symbols, dates, arrays), throwing getters, cycles, `__proto__`,
`constructor` and `prototype` keys at every depth, 1 MB strings, 60,000
tokens, 200 levels of nesting, alias cycles and 40-step chains, CSS
injection (`red;}body{background:url(…)`, `</style><script>`,
`expression(…)`, `url(javascript:…)`, comments) and invisible characters
(U+200B, U+202E) in colors, fonts and identity. Colors pass the spec's
closed forms and `isSafeCssColor`; font names pass the spec's name rule;
names and descriptions refuse markup, CSS blocks and functional notation;
JSON is copied into fresh plain objects, so no prototype is ever written.

## Emitters (`design-system/emit`)

| Export | Output |
| --- | --- |
| `emitCss(compiled, { selector?, dark?, modes? })` | Scoped custom properties: light on the selector (default `[data-tx-ds="<id>"]`, or `:root`), dark on `.dark` (default: `<selector>.dark, .dark <selector>`; `:root.dark`), `[data-tx-mode="dark"]` (`dark: 'attribute'`) or `@media (prefers-color-scheme: dark)` (`dark: 'media'`). A selector `isSafeSelector` refuses (lists, blocks, comments) throws a `TypeError` |
| `emitTailwindPreset(compiled, { values? })` · `emitTailwindPresetJson` | `{ theme: { extend: { colors, borderRadius, fontFamily, spacing, boxShadow } } }`: semantic, state, chart and status colors, `--tx-shape-radius-*` steps (and `DEFAULT`), the three font stacks, the space steps as `tx-<n>`, the elevation ladder. `values: 'vars'` (default) writes `var(--tx-*)`, so the scoped CSS drives every mode; `'light'` or `'dark'` writes concrete values |
| `emitCompiledJson(compiled)` | The compiled design system as JSON, keys sorted at every depth |
| `emitDtcg(doc)` · `emitDtcgJson(doc)` | DTCG in the layout above (2025.10 `{ value, unit }` dimensions and durations, colors as written) |
| `emitTokensStudio(doc)` | Tokens Studio: sets `global`, `light`, `dark`, `$metadata.tokenSetOrder`, legacy `value`/`type` |
| `emitRolePalette(doc, { format?, roleCase? })` | The flat palette, the inverse of `importRolePalette` (radius in rem, stacks as CSS lists). Fields a flat palette cannot hold (pins, type roles, components, variants) are left out |
| `isSafeCompiledValue`, `isSafeSelector` | The checks the emitters apply |

Compiled values are checked again before they are written (no `;`, braces,
`<`, `>`, backslash, `!`, comments, at-rules, `url()`, `image()` or
`expression()`, no invisible characters, balanced quotes; names must be
`--tx-[a-z0-9-]+`), so a cached or hand-edited compiled object cannot
inject CSS. A refused declaration is never written; the CSS says how many
were skipped. For Tailwind 4, keep `@texuli/tokens/tailwind/preset.css` and
add the scoped CSS from `emitCss`.

## Report (`design-system/report`)

`emitReportHtml(compiled, { title? })` returns one self-contained page:
identity and hash, swatches of the 50 roles per mode, the type ramp, a
component sheet per mode (buttons, an input, a link, status badges, a card),
the contrast table, the solver's adjustments and the warnings. No script, a
`default-src 'none'` CSP meta, no time and no random ids.

Markup is only ever produced by an internal `html` tag: every interpolated
value is escaped (`&`, `<`, `>`, `"`, `'`) unless it was itself made by the
tag, and control, bidi and zero-width characters become U+FFFD
(`escapeHtml` is exported). Inline styles are colors that pass the safety
checks or constant `var()` references; the one stylesheet is constant text
plus `emitCss`. A test feeds hostile names, versions, values, warnings and
adjustments and checks that only the report's own tags appear.

## Diff (`design-system/diff`)

`diffDesignSystems(a, b)` compares two compiled design systems (`a` is the
baseline):

| Field | Content |
| --- | --- |
| `tokens` | `{ mode, variable, change: 'added' \| 'removed' \| 'changed', before?, after? }`, light before dark, then by name |
| `contrast` | Pairs that met `a`'s target in `a` and fall below it in `b`: `{ mode, foreground, background, kind, before, after, required }` |
| `defaults` | Component default changes: `{ component, key: 'variant' \| 'size', before?, after? }` |
| `attrs` | Attribute changes (`data-tx-ds-version`, `data-tx-surface`, …) |
| `identical`, `summary` | No change at all; counts per kind |

It never throws: a malformed side reads as empty.

## Fixtures (`design-system/fixtures`)

Fictional data for importer and adapter tests, a fresh copy on every call:

| Export | Round trip proven in `packages/tokens/tests/design-system-io.test.ts` |
| --- | --- |
| `protoyardThemeV1Fixture()` (`PROTOYARD_THEME_V1_FORMAT`) | A flat palette shaped like Protoyard's `protoyard-theme/v1` export: 33 roles per mode, three font stacks, radius, density, the four style knobs and per-mode charts. `emitRolePalette(importRolePalette(f).document, { format: f.format })` equals `f`, with no warning, and the document compiles |
| `dtcgFixture()` | A DTCG file in Texuli's layout: `emitDtcg(importDtcg(f).document)` equals `f` |
| `tokensStudioFixture()` | A Tokens Studio file: `emitTokensStudio(importTokensStudio(f).document)` equals `f` |

The tests also prove document → DTCG → document and document → Tokens
Studio → document for the spec's `acme` and `minimal` fixtures, the
Protoyard knobs fixture and each imported fixture, with no warnings.
`fromProtoyardTheme` itself stays in Protoyard (architecture B.13); its tests
can import these fixtures.
