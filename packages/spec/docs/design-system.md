# The design-system document (`@texuli/spec/design-system`)

> **Status: released in `0.10.0`.** Spec `0.10.0` and the
> `@texuli/spec/design-system` subpath ship in `@texuli/spec@0.10.0`. The
> compiler is `@texuli/tokens/design-system/compile`
> ([design-system-compiler.md](../../tokens/docs/design-system-compiler.md));
> the importers, emitters, report and diff are in
> [design-system-io.md](../../tokens/docs/design-system-io.md), and the
> runtime in [design-system-runtime.md](../../tokens/docs/design-system-runtime.md).
> `texuli ds check` is in [ds-check.md](../../tools/docs/ds-check.md), and the
> `ds.*` operations, `blueprint.theme` and `texuli ds` in
> [ds.md](../../tools/docs/ds.md).

> **Spec 0.11.0 (new in `0.13.0`).** Additive:
> `elevation.levels`, `extensions` and a categorical palette of 1 to 8
> colors. Every 0.10.0 document stays valid; `formatVersion` stays `1`.

> **Spec 0.12.0 (new in `0.14.0`).** Additive: a shadow layer's optional
> `darkOpacity` (0 to 1, its opacity in dark mode), the `aa-non-text`
> issue code and `components.card["font-size"]` (a type role, the card
> content font size). Every 0.11.0 document stays valid; `formatVersion` stays `1`.

> **Spec 0.13.0 (new in `0.15.0`).** Additive
> ([ADR-032](../../../docs/DECISIONS.md#adr-032-locked-design-systems)):
> the optional `allow`, `library` and `approval` sections (a locked design
> system, below), the `approval-invalid` code and the catalog-membership
> codes of `checkDesignSystemAllow`. Every 0.12.0 document stays valid;
> `formatVersion` stays `1`.

> **Spec 0.14.0 (new in `0.16.0`).** Additive:
> `allow` entries gain `colors` (the category color axis of a catalog
> component) and `checkDesignSystemAllow` gains `unknown-color`. Every
> 0.13.0 document stays valid; `formatVersion` stays `1`.

The end-to-end guide (author, validate, apply, distribute, outputs) is
[DESIGN_SYSTEMS](../../../docs/DESIGN_SYSTEMS.md).

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
| `color` | `brand` (`seed` required, `secondary`, `accent`, `neutral`), `pin` (exact brand colors), `roles.light` and `roles.dark` (the 50 semantic roles), `modes` (`light`, `dark`), `dataViz.light` and `dataViz.dark` (1 to 8 categorical, the compiler derives the rest; 9 sequential, 9 diverging, `grid`, `axis`) with `cvdSafe`, `status` |
| `typography` | `families.{sans,heading,mono,serif}` (`stack` of 1 to 8 names, `files` of up to 8 `{ src, weight, style, display, preload }`), `scale` (`base` 12–24, `ratio` 1.05–1.618), `roles.{display,title,heading,body,label,caption,code}` |
| `shape` · `space` | `radius` 0–48, `radiusScale` 0–4, `borderWidth` 0–4 · `base` 2–8, `density` 0.75–1.25 |
| `elevation` · `surface` · `motion` | `style` (flat, soft, crisp, glow, layered) and `levels` (keys `1`–`5`, each 1 to 4 layers of `y` and `x` −64–64, `blur` 0–128, `spread` −64–64, `opacity` 0–1, `darkOpacity` 0–1 from spec 0.12.0, `inset`; `y`, `blur` and `opacity` required) · `style` (solid, glass), `glass` (`alpha` 0–1, `blur` 0–64) · `personality` (none, subtle, standard, expressive), `durations` (0–2,000 ms), a named `easing` |
| `layout` · `icons` | `contentMax`, `wideMax`, `breakpoints`, `grid.columns` and `grid.gutter` per breakpoint · `style`, `stroke`, `size` |
| `components` | Per component id (the token registry of `@texuli/tokens`, z-index left out, and the defaults vocabulary of `texuli`): each token key takes a value of its kind (a radius step, a space/control/icon/target step, a type role, a border step, an elevation level 0–5, an opacity step, a semantic role or a stroke width), and `defaults` takes `variant` and `size` |
| `assets` | `logo.{light,dark,mark,wordmark}` and `favicon` |
| `voice` | `tone` (up to 8 words), `lexicon` (up to 200 entries), `guidelines` (up to 12) — data only |
| `accessibility` | `contrast` (AA, AAA), `targetMin` 24–64, `focus` (ring, outline, glow, inset), `focusWidth`, `focusOffset` |
| `extensions` | Product tokens: up to 32 names (kebab-case, at most 32 characters, never ending in `-foreground`), each `{ light, dark, on? }` with `on` `{ light?, dark? }` (a mode left out, or an empty `on`, is derived by the compiler); compiled to `--tx-ext-<name>` and `--tx-ext-<name>-foreground` |
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

## Locked design systems (spec 0.13.0)

Three optional root sections, described end to end in
[DESIGN_SYSTEMS](../../../docs/DESIGN_SYSTEMS.md#locked-design-systems):

| Section | Shape | Limits |
| --- | --- | --- |
| `allow` | A map of catalog id to `{ variants?, sizes?, tones?, densities?, colors?, states? }`. An omitted list allows every value the catalog lists; an empty list allows none; an id not listed is not allowed | 4096 ids, 32 values per list (`DS_LOCKED_LIMITS`) |
| `library` | `[{ id, name, purpose, version, status, composes, approval? }]`: the design system's own components; `composes` names catalog ids | 64 entries, 32 `composes` each |
| `approval` | `{ status: "draft" \| "approved", version, approvedBy?, approvedAt?, contentHash? }`: top document only, never inherited through `extends` | `contentHash` is 64 lowercase hex |

The structural validator checks the shapes and `approval-invalid` (an
`approved` document without `approvedBy` and `approvedAt`, or an `approved`
library entry without its own approval). Catalog membership needs the
catalog, so it is a separate pure function the bundled validator never
carries: `checkDesignSystemAllow(doc, catalog)` (codes `unknown-component`,
`unknown-variant`, `unknown-size`, `unknown-tone`, `unknown-density`, `unknown-color`,
`unknown-state`, at the `allow` or `library[].composes` path).

`approveDesignSystem(doc, { by, at?, version? })` validates first and
stamps `approval` with `status: "approved"`, who, when and the
`contentHash`; it returns stable codes instead of throwing. It records who
approved; **it cannot prove it**. `APPROVAL_NOTE` says so in one sentence
that tools print: the guarantee is a reviewed commit of the document by its
`CODEOWNERS`.

`designSystemContentHash(doc)` is the SHA-256 of the canonical JSON
(`canonicalJson`: sorted keys, no whitespace; `sha256Hex`) of the document
without `approval` (`APPROVAL_HASH_EXCLUDED`), with every library entry also
without its own `approval`; `libraryEntryContentHash(entry)` is the same for
one entry. Key order never changes a hash.

`initLockedDesignSystem({ id, name, …, preset?, catalog })` makes a new
locked draft from the `minimal` preset (`MINIMAL_LOCKED_COMPONENTS`), `all`
(`LOCKED_PRESETS`) or an explicit `allow` section, checked against the
catalog it is given; `lockedAllowPreset` and `fullAllowEntry` build the
sections.

Root attributes: `DS_COMPONENT_ATTRIBUTE` (`data-tx-component`),
`DS_VARIANT_ATTRIBUTE`, `DS_SIZE_ATTRIBUTE`, `DS_TONE_ATTRIBUTE`,
`DS_DENSITY_ATTRIBUTE` and `dsRootAttributes(id, axes)`, the attributes
every catalog component root carries so a checker maps an element to its
component.

## Codes

| Code | When |
| --- | --- |
| `unknown-key` | A key outside a closed object, including `__proto__`, `constructor` and `prototype`; the hint lists the allowed keys |
| `invalid-type` | The wrong JSON type |
| `invalid-value` | An enum, pattern, range, length, duplicate, reserved or malformed map key, or a size cap; also free text (`name`, `description`, voice guidelines and lexicon values) holding a control, bidi or invisible character: C0 and C1 controls, U+00AD, U+061C, U+180E, U+200B–200F, U+2028–202E, U+2060–2069, U+FEFF and the tag characters U+E0000–E007F (the set the `@texuli/tokens` importers refuse, plus the separators and tags; a joiner inside an emoji sequence is refused too) |
| `required` | A missing identity field or `color.brand.seed` |
| `format-version` | `formatVersion` missing, not an integer, below 1 or newer than this package; validation stops there |
| `extends-range` | A range-shaped `extends` or `ref` (`^`, `~`, `*`, `x`, `>=`, `\|\|`, `acme@2`) |
| `extends-cycle` | Extending yourself, or (with `resolve`) any loop in the chain |
| `extends-depth` | With `resolve`, a chain longer than 4 |
| `url-refused` | A remote URL or scheme, `//`, traversal, an SVG or wrong media type, any data URL at `untrusted` |
| `inline-bytes` | A data URL over its cap, or over the 256 KiB total |
| `aa-text`, `aa-focus`, `target-size` | Raised by the compiler in `@texuli/tokens` (from spec 0.11.0, `aa-text` also covers a product token's on-color, at `$.extensions.<name>.on.<mode>`) ([ADR-022](../../../docs/DECISIONS.md#adr-022-design-system-guarantees-enforced-never-reported)); never by the spec |
| `approval-invalid` | From spec 0.13.0: an `approved` document without `approvedBy` and `approvedAt`, or an `approved` library entry without its own approval |
| `unknown-component`, `unknown-variant`, `unknown-size`, `unknown-tone`, `unknown-density`, `unknown-color`, `unknown-state` | From spec 0.13.0 (`unknown-color` from 0.14.0): raised by `checkDesignSystemAllow` (not by `validateDesignSystem`): an `allow` id or value, or a `library[].composes` id, that the catalog does not list |
| `aa-non-text` | From spec 0.12.0: a role fill below 3:1 against its container (WCAG 1.4.11), such as the sidebar's active fill on the sidebar. A warning in the compiler's report; raised by `checkDesignSystemIndicators` in `@texuli/tokens`, `texuli ds check` and `ds.validate`; never by the spec |

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
| `checkDesignSystemAllow(doc, catalog)` | Spec 0.13.0: `{ ok, errors }` for the catalog membership of `allow` and `library[].composes`; the catalog is an argument (`{ components: [{ id, axes?, states? }] }`); total, at most 64 issues |
| `approveDesignSystem(doc, options)`, `APPROVAL_NOTE` | Spec 0.13.0: stamp an approval with its content hash (records, never proves, who approved) |
| `designSystemContentHash(doc)`, `libraryEntryContentHash(entry)`, `canonicalJson`, `sha256Hex`, `APPROVAL_HASH_EXCLUDED` | Spec 0.13.0: the approval hashes |
| `initLockedDesignSystem(options)`, `lockedAllowPreset`, `fullAllowEntry`, `LOCKED_PRESETS`, `MINIMAL_LOCKED_COMPONENTS` | Spec 0.13.0: a new locked draft from a preset over the catalog |
| `dsRootAttributes(id, axes)`, `DS_*_ATTRIBUTE` | Spec 0.13.0: the component root attributes |
| Constants | `DESIGN_SYSTEM_FORMAT`, `DESIGN_SYSTEM_FORMAT_VERSION`, `DESIGN_SYSTEM_CODES`, `DESIGN_SYSTEM_ALLOW_CODES`, `DESIGN_SYSTEM_COMPILER_CODES`, `DESIGN_SYSTEM_LIMITS` |
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
  fetch), compile lazily, and apply the result to their root scope; the
  player also hands the compiled component defaults to the painted
  components (blueprint props still win). A reference nothing resolves, or
  a document the compiler refuses, paints with the default theme and a
  visible notice; neither throws. A deck as a blueprint (a `layout-deck`
  root) follows the envelope's design system, and so does a document root.
- **Standalone decks:** a `@texuli/deck` model v2 deck names its own with a
  top-level `designSystem` of the same shape (the deck validator holds the
  same `ref` grammar, and a test compares it with
  `$defs.designSystemReference`), and the `@texuli/slides` stage applies it
  through the player's step (`@texuli/player/design-system`): the host's
  resolver, no fetch, a notice, never a throw
  ([deck model](../../deck/docs/model.md#design-systems),
  [stage](../../slides/docs/stage.md#design-systems)). The deck format is
  not part of this contract (it is `@texuli/deck`'s own JSON Schema), so
  the spec digest does not change.
- **Writers:** the document Markdown writer carries `designSystem` in front
  matter, losslessly; the DOCX and PDF writers take compiled `design`
  values from the caller (the L1 engine cannot import the compiler) and
  report `design-system-unapplied` when the document names one and none
  are given ([document Markdown](../../document/docs/markdown.md#design-system-front-matter),
  [PDF](../../document/docs/pdf.md#design-systems)).

## Size

The subpath measures 6.91 KiB gzipped (`pnpm size --filter spec`), over the
4 KB target in the architecture: the closed component vocabulary (365 token
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
