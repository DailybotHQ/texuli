# The design-system document (`@texuli/spec/design-system`)

> **Status: in development for `0.10.0`, not on npm.** Spec `0.10.0` and
> the `@texuli/spec/design-system` subpath exist on the `release/0.10.0`
> branch; they ship only with `@texuli/spec@0.10.0`. The compiler is
> `@texuli/tokens/design-system/compile` on the same branch
> ([design-system-compiler.md](../../tokens/docs/design-system-compiler.md));
> the importers, emitters, report and diff are on the same branch
> ([design-system-io.md](../../tokens/docs/design-system-io.md)), and so is
> the runtime ([design-system-runtime.md](../../tokens/docs/design-system-runtime.md)).
> The `ds.*` operations and `texuli ds check` are **planned** (later
> PLAN_011 tasks, ADR-021 to ADR-023).

A design system describes a brand once, as one closed JSON document that
a company or an agent writes, and every Texuli surface follows
([ADR-021](../../../docs/DECISIONS.md#adr-021-the-design-system-document)).
This subpath is its contract: the generated types, a validator with stable
codes and JSON paths, a typed patch with a pure merge, a total migration
and the check for a blueprint's design-system reference. It is
framework-free and has no dependencies.

```ts
import {
  applyDesignSystemPatch,
  migrateDesignSystem,
  validateDesignSystem,
  validateDesignSystemPatch,
} from '@texuli/spec/design-system';

const migrated = migrateDesignSystem(saved); // never throws
if (migrated.ok) {
  const result = validateDesignSystem(migrated.document); // trust: 'untrusted' by default
  if (!result.ok) console.log(result.errors); // [{ code, path, message, hint? }]
}
const patch = { color: { brand: { seed: '#b91c1c' } }, voice: { lexicon: { workspace: null } } };
if (validateDesignSystemPatch(patch).ok) {
  const next = applyDesignSystemPatch(base, patch); // validate `next` again
}
```

## The document

Identity is required: `format` (`"texuli/design-system"`), `formatVersion`
(`1`), `id` (`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, ASCII, at most 64), a strict
semver `version` and `name`. `description`, `owner`, `license` and up to
16 `tags` are optional. Every section is optional, every object is closed,
lengths are numbers in px, and nothing is raw CSS.

| Section | Fields |
| --- | --- |
| `extends` | `texuli:<theme>` or an exact `id@x.y.z` (never a range, a URL or a path) |
| `color` | `brand` (`seed` required, `secondary`, `accent`, `neutral`), `pin` (exact brand colors), `roles.light` and `roles.dark` (the 50 semantic roles), `modes` (`light`, `dark`), `dataViz.light` and `dataViz.dark` (8 categorical, 9 sequential, 9 diverging, `grid`, `axis`) with `cvdSafe`, `status` |
| `typography` | `families.{sans,heading,mono,serif}` (`stack` of 1 to 8 names, `files` of up to 8 `{ src, weight, style, display, preload }`), `scale` (`base` 12–24, `ratio` 1.05–1.618), `roles.{display,title,heading,body,label,caption,code}` |
| `shape` · `space` | `radius` 0–48, `radiusScale` 0–4, `borderWidth` 0–4 · `base` 2–8, `density` 0.75–1.25 |
| `elevation` · `surface` · `motion` | `style` (flat, soft, crisp, glow, layered) · `style` (solid, glass), `glass` (`alpha` 0–1, `blur` 0–64) · `personality` (none, subtle, standard, expressive), `durations` (0–2,000 ms), a named `easing` |
| `layout` · `icons` | `contentMax`, `wideMax`, `breakpoints`, `grid.columns` and `grid.gutter` per breakpoint · `style`, `stroke`, `size` |
| `components` | Per component id (the token registry of `@texuli/tokens`, z-index left out, and the defaults vocabulary of `texuli`): each token key takes a value of its kind (a radius step, a space/control/icon/target step, a type role, a border step, an elevation level 0–5, an opacity step, a semantic role or a stroke width), and `defaults` takes `variant` and `size` |
| `assets` | `logo.{light,dark,mark,wordmark}` and `favicon` |
| `voice` | `tone` (up to 8 words), `lexicon` (up to 200 entries), `guidelines` (up to 12) — data only |
| `accessibility` | `contrast` (AA, AAA), `targetMin` 24–64, `focus` (ring, outline, glow, inset), `focusWidth`, `focusOffset` |
| `variants` | Up to 16 named partial documents (`high-contrast`, `compact`, seasonal) of the sections above, orthogonal to mode; no identity, `extends` or nested `variants` |

The full schema is
[`schemas/design-system.schema.json`](../schemas/design-system.schema.json),
generated from the vocabulary table in `src/design-system/vocabulary.ts`.
The fixtures in [`fixtures/design-systems/`](../fixtures/design-systems/)
show every section (`acme.json`) and the smallest document
(`minimal.json`).

**Data only.** Colors are `#rgb`, `#rrggbb`, `#rrggbbaa` or a numeric
`oklch(L C H[ / A])`; font names are letters, digits, spaces, `_`, `.`
and `-` (at most 33 characters, the compiler quotes them); everything else
that can reach CSS is an enum or a number. Tests check that every accepted
color and stack also passes `isSafeCssColor` and `isSafeFontFamily` of
`@texuli/tokens`.

**Fonts and assets.** A same-origin relative path (`a/b.svg`, `./a.png`,
`/a.webp`; never `..`, `\`, `%`, `?`, `#` or `//`) with an image or font
extension. At `trust: 'developer'` (documents the host supplies) a base64
`data:image/(png|jpeg|gif|webp|avif)` or `data:font/(woff2|woff|ttf|otf)`
is accepted within its cap: 32 KiB per logo, 8 KiB for the favicon,
128 KiB per font file and 256 KiB in total, measured from the base64
length. The default `untrusted` level (agent or user documents) refuses
every data URL, and SVG is a relative path only. Remote URLs are always
refused. Tests check that every accepted image also passes `safeImageSrc`
of `@texuli/core` at the same trust.

## Codes

| Code | When |
| --- | --- |
| `unknown-key` | A key outside a closed object, including `__proto__`, `constructor` and `prototype`; the hint lists the allowed keys |
| `invalid-type` | The wrong JSON type |
| `invalid-value` | An enum, pattern, range, length, duplicate, reserved or malformed map key, or a size cap |
| `required` | A missing identity field or `color.brand.seed` |
| `format-version` | `formatVersion` missing, not an integer, below 1 or newer than this package; validation stops there |
| `extends-range` | A range-shaped `extends` or `ref` (`^`, `~`, `*`, `x`, `>=`, `\|\|`, `acme@2`) |
| `extends-cycle` | Extending yourself, or (with `resolve`) any loop in the chain |
| `extends-depth` | With `resolve`, a chain longer than 4 |
| `url-refused` | A remote URL or scheme, `//`, traversal, an SVG or wrong media type, any data URL at `untrusted` |
| `inline-bytes` | A data URL over its cap, or over the 256 KiB total |
| `aa-text`, `aa-focus`, `target-size` | Raised by the compiler in `@texuli/tokens` ([ADR-022](../../../docs/DECISIONS.md#adr-022-design-system-guarantees-enforced-never-reported)); never by the spec |

Paths start at `$`; keys that are not identifiers are quoted
(`$.components["icon-button"].radius`). Issues stop at `maxErrors`
(64 at most), and a document is capped at 20,000 values and depth 16; a
maximal legal document (every section full, 16 variants) is about 18,000
values.

## API

| Export | What it does |
| --- | --- |
| `validateDesignSystem(doc, { trust?, resolve?, maxErrors? })` | `{ ok, errors }`; never throws on a JSON value. `resolve(ref)` (synchronous) enables the cycle and depth checks |
| `validateDesignSystemPatch(patch, options?)` | Checks a `DesignSystemPatch`: the sections only, every field optional, `null` to remove a field or a map entry |
| `applyDesignSystemPatch(base, patch)` | Pure merge: objects merge, arrays and scalars replace, `null` removes, reserved keys are skipped. Validate the result again |
| `migrateDesignSystem(doc)` | `{ ok: true, document, from, to, applied }` or `{ ok: false, errors: [issue] }`; pure and total. `DESIGN_SYSTEM_MIGRATIONS` is empty for `formatVersion` 1 |
| `checkDesignSystemReference(value, options?)` | The blueprint's (and a document's) `designSystem`, `$defs.designSystemReference`: exactly one of `ref` and `inline`; `inline` runs through `validateDesignSystem`. Fits `validateDraft`'s `checkDesignSystem` as is |
| Constants | `DESIGN_SYSTEM_FORMAT`, `DESIGN_SYSTEM_FORMAT_VERSION`, `DESIGN_SYSTEM_CODES`, `DESIGN_SYSTEM_COMPILER_CODES`, `DESIGN_SYSTEM_LIMITS` |
| Types | `DesignSystem` and every section type (generated), `DesignSystemIssue`, `DesignSystemPatch`, `DesignSystemValidation` |

Kotlin: `DesignSystem.kt` in `generated/kotlin/` holds the same types with
closed decoders (`DesignSystem.decode`); hyphenated keys become camelCase
properties (`iconButton`, `heightMd`). Native validation of patterns and
caps is not built: the native twin decodes, the TypeScript validator
checks.

## In blueprints and documents

From spec `0.10.0` (T-ds-blueprint,
[ADR-024](../../../docs/DECISIONS.md#adr-024-design-systems-on-every-surface))
a blueprint envelope, and a document (`$defs.document`, `@texuli/document`),
may name the design system it follows:

```jsonc
{ "format": "texuli-blueprint", "version": 1, "spec": "0.10.0", /* … */
  "designSystem": { "ref": "acme@2.1.0" },          // the host resolves it
  // or: "designSystem": { "inline": { "format": "texuli/design-system", … } }
  "tree": { "id": "layout-deck", /* … */ } }
```

- **Closed:** exactly one of `ref` and `inline`; any other key is refused.
  `ref` is an exact `id@x.y.z` or `texuli:<theme>` (a library theme),
  never a range (`extends-range`), a URL or a path (`url-refused`).
- **Checked:** `checkDesignSystemReference(value, { trust })` is the whole
  check. `@texuli/catalog`'s `validateDraft` runs it when the host passes it
  as `checkDesignSystem` (codes and paths under `$.designSystem`, at the
  draft's tier, so agent output refuses every `data:` URL); without it the
  shape and the `ref` grammar are still checked and the inline rules are
  `skipped` in the receipt. A host with `@texuli/tokens` can compile the
  inline document as well, for the guarantee codes.
- **Applied:** `@texuli/player` (`designSystems: { resolve, mode }`) and
  `@texuli/pages`' `PageReader` resolve a `ref` through the host (never a
  fetch), compile lazily, and apply the result to their root scope. A
  reference nothing resolves, or a document the compiler refuses, paints
  with the default theme and a visible notice; neither throws. A deck as a
  blueprint (a `layout-deck` root) follows the envelope's design system,
  and so does a document root. The deck model's own `themeRef`
  (`@texuli/deck`, model v2) does not name a design system yet (planned).

## Size

The subpath measures 6.91 KiB gzipped (`pnpm size --filter spec`), over the
4 KB target in the architecture: the closed component vocabulary (364 token
keys for 67 components, plus the defaults lists) and the 50 roles are about
4 KB on their own. The budget is measured + 4% (`texuli.budgets.json`).

## Editing the vocabulary

1. Change `src/design-system/vocabulary.ts` (the tests compare the
   component table with `COMPONENT_TOKEN_FAMILIES` and
   `DESIGN_DEFAULTS_VOCABULARY`, and the roles, neutrals, easings and type
   roles with `@texuli/tokens`).
2. `pnpm exec tsx packages/spec/scripts/design-system-schema.ts`, then
   `pnpm exec tsx packages/spec/scripts/generate.ts`.
3. A normative change needs a new spec version ([contract.md](contract.md)),
   and a breaking change to the document needs a `formatVersion` bump with a
   migration and a `fixtures/design-systems/migrations/` fixture.
