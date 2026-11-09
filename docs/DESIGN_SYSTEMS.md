# Design systems

> **Status: released in `0.10.0`.** Everything on this page (the
> document, the compiler, the runtime, the importers and emitters, the
> `ds.*` operations, `texuli ds` and the example brands) ships in the 0.10
> line on npm; 0.9.0 had none of it (it has token contract v2, component
> tokens, hooks and design defaults, the plumbing this builds on). Items
> marked **planned** are not built yet. [Locked design systems](#locked-design-systems)
> (blueprint spec `0.13.0`, ADR-032) are built on `main`'s next line and
> are **not published yet**: they are planned for `0.15.0` (the document,
> the catalog, the allow manifest and the CLI) and `0.16.0` (the kit page
> and the checker core).

A design system describes a brand once, as **one closed JSON document**,
and every Texuli surface follows it: styled components, layouts and domain
packages, the blueprint player, documents and pages, decks, email, PDF,
DOCX, PPTX, canvas exports and the Kotlin twin. A company writes it by
hand, imports it from tokens it already has, or has an agent write it
through the MCP. The document is data only (colors, numbers, enums, font
names, relative asset paths), so an agent can never emit CSS or script
through it, and Texuli enforces the accessibility guarantees instead of
reporting them.

Decisions:
[ADR-021](DECISIONS.md#adr-021-the-design-system-document) (the document),
[ADR-022](DECISIONS.md#adr-022-design-system-guarantees-enforced-never-reported)
(guarantees),
[ADR-023](DECISIONS.md#adr-023-design-system-runtime-and-scoping) (runtime
and scoping),
[ADR-024](DECISIONS.md#adr-024-design-systems-on-every-surface) (every
surface),
[ADR-032](DECISIONS.md#adr-032-locked-design-systems) (locked design
systems). Reference docs: [the document](../packages/spec/docs/design-system.md),
[the compiler](../packages/tokens/docs/design-system-compiler.md),
[importers, emitters, report and diff](../packages/tokens/docs/design-system-io.md),
[the runtime](../packages/tokens/docs/design-system-runtime.md),
[`DesignSystemProvider`](../packages/texuli/docs/design-system.md#designsystemprovider),
[the agent operations and `texuli ds`](../packages/tools/docs/ds.md) and
[`texuli ds check`](../packages/tools/docs/ds-check.md).

## The pipeline

```text
author ──► validate ──► compile ──► apply / emit
(by hand,   (spec codes,  (concrete    (scoped CSS variables, SSR style,
 importers,  JSON paths)   --tx-* per   no-flash cache, provider, player,
 agents)                   mode; AA     email, PDF, DOCX, PPTX, canvas,
                           enforced)    Kotlin tokens)
```

| Step | Where | Cost to an app |
| --- | --- | --- |
| Validate | `@texuli/spec/design-system` (6.91 KiB gzip), re-exported with the guarantee re-check by `@texuli/tokens/design-system/validate` (9,850 B gzip) | Only where documents are validated: studio, CLI, MCP, hosts checking saved documents |
| Compile | `@texuli/tokens/design-system/compile` (30,780 B gzip; library themes in lazy chunks) | Build time, the CLI or a lazy chunk; never in an app's initial bundle unless it compiles at run time |
| Apply | `@texuli/tokens/design-system/apply` (2,040 B gzip), `texuli/design-system` | The compiled variables of one design system |

## Example brands

Three fictional brands live in [`examples/design-systems/`](../examples/design-systems/),
one file each. They are the worked examples of this page, and the tests
hold them to zero refusals: `packages/tokens/tests/examples.test.ts`
compiles each in light and dark (base and every variant) with every
guarantee held, and `tests/e2e/ds-conformance.spec.ts` paints every
agent-emittable catalog component under each one in chromium (axe, painted
contrast, literal colors). The MCP serves them as
`texuli://design-system/{quillmark,ledgerline,tumbletown}`.

| Id | Character | What it shows |
| --- | --- | --- |
| `quillmark` | A literary magazine: warm paper neutrals, a terracotta seed, a serif body, flat surfaces, subtle motion | `color.brand` with a `warm` neutral, `typography.families` and `roles`, `layout`, `voice`, relative logo paths |
| `ledgerline` | A finance back office: dense (`space.density` 0.875), 14 px base type, crisp edges, small default buttons | `extends: "texuli:slate-masthead"`, component defaults, a `high-contrast` variant at AAA and a `compact` variant |
| `tumbletown` | A family game studio: 20 px radius, pill buttons, expressive motion, 44 px targets | `color.pin.primary` (the brand pink kept exactly), `accessibility.targetMin` 44 (control heights lifted), `focus: "glow"` |

Why `examples/` and not a package: the spec's fixtures
(`packages/spec/fixtures/design-systems/`, `acme` and `minimal`) are part
of the normative spec, and the tokens fixtures subpath ships to adopters'
tests. Example brands are neither: they are documentation that tests load
by path, so they live at the repository root, outside every package.

## Author

The document's shape is in [the spec doc](../packages/spec/docs/design-system.md):
identity (`format`, `formatVersion`, `id`, `version`, `name`), then
optional sections (`extends`, `color`, `typography`, `shape`, `space`,
`elevation`, `surface`, `motion`, `layout`, `icons`, `components`,
`assets`, `voice`, `accessibility`, `extensions`, `variants`). Every object is closed,
lengths are numbers in px, and nothing is raw CSS.

### By hand

The smallest valid document is a brand color:

```json
{
  "format": "texuli/design-system",
  "formatVersion": 1,
  "id": "harborline",
  "version": "1.0.0",
  "name": "Harborline",
  "color": { "brand": { "seed": "#0e7490" } }
}
```

`color.brand.seed` (with optional `secondary`, `accent` and `neutral`)
goes through the theme generator, which already meets the contrast target.
Pin a color (`color.pin.primary`) only when the brand requires that exact
fill; pin a role (`color.roles.light.foreground`) only when it must never
move. The solver then moves only what no pin holds, and refuses (`aa-text`)
when only pins can fix a pair.

### Brand-specific fields (spec 0.11.0)

Spec `0.11.0` adds these to the document (new in `0.13.0`:
`@texuli/spec@0.13.0` carries spec `0.11.0`). The `0.10.0` to `0.12.3`
packages carry spec `0.10.0`, which refuses them (`unknown-key`, or
`invalid-value` for a short palette). Every 0.10.0 document stays valid.

```json
{
  "elevation": {
    "style": "soft",
    "levels": {
      "1": [{ "y": 1, "blur": 2, "opacity": 0.08 }, { "y": 1, "blur": 3, "opacity": 0.1 }],
      "3": [{ "y": 8, "blur": 24, "spread": -6, "opacity": 0.16 }]
    }
  },
  "extensions": {
    "brand-gold": { "light": "#fef3c7", "dark": "#78350f", "on": { "light": "#451a03", "dark": "#fffbeb" } },
    "focus-band": { "light": "#e0e7ff", "dark": "#312e81", "on": {} },
    "chart-stripe": { "light": "#c7d2fe", "dark": "#3730a3" }
  },
  "color": {
    "brand": { "seed": "#4f46e5" },
    "dataViz": { "light": { "categorical": ["#4f46e5", "#0ea5e9", "#f59e0b"] } }
  }
}
```

- **Shadows per level** (`elevation.levels`): keys `1` to `5`, each 1 to 4
  layers of `y`, `blur` and `opacity` (required) and `x`, `spread` and
  `inset` (optional). Offsets and spread are -64 to 64 px, blur 0 to 128
  px, opacity 0 to 1. A level compiles to `--tx-elevation-<level>` as a
  concrete `box-shadow` in the mode's `shadow` role color at each layer's
  opacity (the role's own alpha is replaced, so the same opacity holds in
  both modes); levels left out keep `elevation.style`'s shadows. There is
  no raw CSS string anywhere.
- **Product tokens** (`extensions`): up to 32 kebab-case names of at most
  32 characters (never ending in `-foreground`), each a `light` and a
  `dark` color and an optional `on`. They compile to `--tx-ext-<name>`
  per mode. With `on`, they also compile `--tx-ext-<name>-foreground`:
  the color given for the mode, or one derived for it (white or near
  black, recorded in `report.adjustments`). The pair is held to the text
  target in both modes; a pinned `on` that misses it is `aa-text` at
  `$.extensions.<name>.on.<mode>`. Variants and patches may set them too.
- **Short categorical palettes**: `color.dataViz.<mode>.categorical` takes
  1 to 8 colors. The given colors stay exactly as written; the compiler
  derives the rest deterministically (free hues, 3:1 on the surface and
  the page, separated from every earlier color under normal and simulated
  color-vision deficiency where a move can) and records each one in
  `report.adjustments` (`path` `$.color.dataViz.<mode>.categorical`).
  Sequential (9) and diverging (9) are unchanged.
- **Soft fills with their own ink**: pin `color.roles.<mode>.<role>SoftForeground`
  (`primary`, `destructive`, `success`, `warning`, `info`) and the soft
  fill is held to that ink only, not to the page foreground, so a pastel
  chip with dark text works in dark mode. When the page foreground then
  misses the target on the fill, the compiler writes
  `--tx-<role>-soft-body` (the ink), and the components that put body text
  on soft fills (the alert body, calendar events) read it; the guarantee
  checks the body ink, or the page foreground when it is absent.
- **The sidebar's active fill**: `color.pin.primary` is copied into
  `sidebarPrimary` unless the copy would equal the sidebar fill or miss
  3:1 against it (a sidebar painted in the brand color). Then the compiler
  derives it along the primary's hue: the nearest lightness that keeps the
  primary on-color at the text target and reaches 3:1 against the
  sidebar, or, when no lightness can, the one that stands out most. The
  change is in `report.adjustments`.

### Spec 0.12.0: dark shadows, the sidebar's active fill and the card content size

New in `0.14.0`, which carries spec `0.12.0` (the `0.13.x` packages
carry spec `0.11.0`, which refuses `darkOpacity` as
`unknown-key`). Every 0.11.0 document stays valid and compiles to the same
variables.

```json
{
  "elevation": {
    "levels": {
      "2": [
        { "y": 2, "blur": 6, "opacity": 0.12, "darkOpacity": 0.48 },
        { "y": 0, "blur": 1, "opacity": 0.08 }
      ]
    }
  }
}
```

- **Shadow alpha per mode** (D-G-028): a layer's optional `darkOpacity`
  (0 to 1) is its opacity in dark mode; `opacity` stays the light one, and
  the dark one when `darkOpacity` is absent. The compiled value is still a
  concrete `box-shadow` of numbers (`0 2px 6px 0 #rrggbb7a` in dark).
- **The sidebar's active fill under role pins** (D-G-027): `sidebarPrimary`
  is derived whenever it would equal the sidebar fill or miss 3:1 against
  it and the document does not pin `color.roles.<mode>.sidebarPrimary`
  itself, whatever pinned the colors: `color.pin.primary`, or
  `color.roles.<mode>.primary` and `color.roles.<mode>.sidebar` (before
  0.14.0 only the brand pin was covered, so a primary role pin painted an
  invisible active item). The derivation follows the primary's hue, as
  above. A `sidebarPrimary` role pin never moves: it is reported instead.
- **Non-text contrast** (D-G-029, `aa-non-text`): role fills against the
  container they sit on, at 3:1 (WCAG 1.4.11): `sidebarPrimary` on
  `sidebar` (the active item's only cue, so `texuli ds check` and
  `ds.validate` refuse it) and `primary` on `background` (advisory: a
  filled button is also identified by its label, so a light brand pin such
  as a yellow primary stays valid). The compiler never refuses either one;
  it lists each failing pair in `report.warnings` as
  `{ code: "aa-non-text", mode, path, message }`, with the pinned path.
- **The card content font size** (D-G-038): `components.card["font-size"]`
  takes a type role (`caption`, `label`, `body` …) and compiles to
  `--tx-card-font-size` (`"body"` gives `var(--tx-type-body-size)`), which
  `.tx-card__content` reads. Left out, the content keeps the label size it
  had before. Like `components.button["line-height"]`, it is one key of
  the closed component vocabulary (365 tokens for 57 components); spec
  `0.11.0` refuses it as `unknown-key`.

```json
{ "components": { "card": { "font-size": "body" } } }
```

### From what you already have

Every importer in `@texuli/tokens/design-system/import` is pure,
deterministic and never throws: it returns `{ ok: true, document,
warnings }` (each dropped value is a warning with a path) or `{ ok: false,
errors }`.

| Source | Importer | Agent operation | CLI |
| --- | --- | --- | --- |
| A brand one-liner (`brand #4f46e5, font Inter, rounded, compact`) | `importBrand` | `ds.import` `from: "brand"` | `texuli ds init <file> --brand …` |
| W3C DTCG (2025.10 color objects, aliases) | `importDtcg` | `ds.import` `from: "dtcg"` | `texuli ds import <file> --from dtcg` |
| Tokens Studio (sets, `$metadata.tokenSetOrder`) | `importTokensStudio` | `ds.import` `from: "tokens-studio"` | `--from tokens-studio` |
| A flat role palette (33 roles per mode, the `protoyard-theme/v1` shape) | `importRolePalette` | `ds.import` `from: "role-palette"` | `--from role-palette` |
| A Texuli `Theme`, or a library theme id | `importTheme` (`fromThemeWithReport`) | `ds.import` `from: "theme"` | `texuli ds import ocean --from theme` |
| A logo's RGBA pixels | `importLogoPixels` (dominant colors, then the seed engine) | `ds.suggest` `pixels` | — |
| One seed, or up to three brand colors | `importBrand` | `ds.suggest` `seed` or `colors` | — |

A DTCG or Tokens Studio file written by `emitDtcg` or `emitTokensStudio`
round-trips losslessly (document → file → document), because what is not a
token travels in `$extensions["com.texuli.design-system"]`.

### With an agent

The MCP prompt `create-design-system` (brief, optional `base` theme and
`contrast`) walks an agent through the loop: read
`texuli://design-system/acme`, start from `ds.import` or `ds.suggest`,
write the sections, `ds.validate` until valid, check `ds.contrast` and
`ds.preview`, then deliver. A brand URL is an agent-side step at most: the
compiler never fetches. The skill's [design-systems sub-skill](../skills/texuli/design-systems/SKILL.md)
is the same loop for hosts with skills.

## Validate

```bash
texuli ds validate examples/design-systems/quillmark.json    # JSON; exit 1 when refused
texuli ds check examples/design-systems/ledgerline.json      # summary per mode and variant
```

`validateDesignSystem(doc, { trust })` (the spec) checks the closed shape;
the compiler adds the guarantees. `ds.validate` and `texuli ds check` run
both, plus the `high-contrast` variant when the document declares one.
Every issue has a stable `code`, a `$`-rooted JSON `path`, a `message` and
often a `hint`. `trust: "untrusted"` (the default; agent and user documents)
refuses every `data:` URL; `developer` (documents the host supplies)
accepts capped ones.

| Code | Meaning | Fix |
| --- | --- | --- |
| `unknown-key` | A key outside a closed object (including `__proto__`, `constructor`, `prototype`) | Remove it; the hint lists the allowed keys |
| `invalid-type` | The wrong JSON type | Use the type the path expects |
| `invalid-value` | An enum, pattern, range, length, duplicate or size cap failed; also an `extends` nothing resolves, or an undeclared variant | Change the value at the path; for `extends`, pass the base (`bases`, `--base`) or name a library theme |
| `required` | A missing identity field or `color.brand.seed` | Add the field |
| `format-version` | `formatVersion` missing, not an integer or newer than this package (validation stops) | Use `1`, or upgrade Texuli |
| `extends-range` | A range-shaped `extends` or `ref` (`^1.0.0`, `acme@2`) | Use an exact `id@x.y.z` or `texuli:<theme>` |
| `extends-cycle` | A document extends itself, directly or through its chain | Break the loop |
| `extends-depth` | A chain longer than 4 | Flatten the chain |
| `url-refused` | A remote URL or scheme, `//`, traversal, SVG outside a relative path, a wrong media type, any `data:` URL at `untrusted` | A same-origin relative path (`brand/logo.svg`) |
| `inline-bytes` | A `data:` URL over its cap (32 KiB per logo, 8 KiB favicon, 128 KiB per font) or over 256 KiB in total | Use a relative path, or a smaller file |
| `aa-text` | A text pair below the target (4.5:1 AA, 7:1 AAA), or a strong border or input below 3:1, that only pins can fix; from spec 0.11.0 also a product token's on-color (`$.extensions.<name>.on.<mode>`) | Unpin one of the colors the hint names, or pick a darker or lighter pin; for a product token, leave that mode out of `on` so it is derived |
| `aa-focus` | The focus ring below 3:1 against the page or surface, or `focusWidth` under 2 px | Unpin `ring` or widen the focus |
| `aa-non-text` | From spec 0.12.0: the sidebar's active fill (`sidebarPrimary`) below 3:1 against the sidebar fill (WCAG 1.4.11), at `$.vars.<mode>["--tx-sidebar-primary"]`; raised by `texuli ds check` and `ds.validate` (`checkDesignSystemIndicators`), a warning in the compiler's report | Leave `color.roles.<mode>.sidebarPrimary` out so the compiler derives it, or pin a `sidebarPrimary` or `sidebar` that reaches 3:1 |
| `target-size` | A pinned component size below `accessibility.targetMin` | Pick a size at or above the target |
| `approval-invalid` | From spec 0.13.0: an `approved` document without `approvedBy` and `approvedAt`, or an `approved` library entry without its own approval | Approve with `texuli ds approve`, or set the status back to `draft` |
| `unknown-component`, `unknown-variant`, `unknown-size`, `unknown-tone`, `unknown-density`, `unknown-state` | From spec 0.13.0: an `allow` id, or a value of one of its lists, that the catalog does not list; also a `library[].composes` id. Raised by `checkDesignSystemAllow` and `texuli ds check`, not by the bundled validator | Use a catalog id and the values its `axes` and `states` list (`ds.allow` lists them) |
| `content-hash-mismatch`, `library-hash-mismatch` | Raised by `texuli ds check` only: the `contentHash` an approval records no longer matches the document (or the library entry). It changed after approval | Review the change, then approve again with `texuli ds approve` |

An agent repairs a refused document from the code and the path alone; the
agent evals (`tests/agent-evals/sessions.ts`) prove it on a document with
five classes of mistakes.

## Compile and apply

```ts
import { compileDesignSystem, resolveDesignSystem } from '@texuli/tokens/design-system/compile';

const resolved = await resolveDesignSystem(doc); // loads extends: "texuli:<id>" lazily
if (!resolved.ok) throw new Error(resolved.errors[0]?.message);
const compiled = compileDesignSystem(resolved.document);
if (compiled.ok) {
  compiled.vars.light; // { '--tx-background': '#ffffff', … } concrete values, sorted
  compiled.attrs; // { 'data-tx-ds': 'quillmark', … } an allowlisted attribute set
}
```

A design system sets theme roles and component tokens; it does not declare
the system token defaults (`--tx-space-unit`, `--tx-size-*`,
`--tx-shape-radius-*`…) that component CSS reads with no fallback. The host
must load `@texuli/tokens/base.css`, or `@texuli/tokens/system.css` (the
defaults alone, for a host with its own reset; from `0.10.0`), or
controls render with no size.

The compiled object is plain JSON: cache it (`emitCompiledJson`, or
`texuli ds compile <file> --out brand.compiled.json`) and ship only that to
the app. Its `hash` is stable regardless of key order.

| Where | How |
| --- | --- |
| Any element (client) | `applyDesignSystem(el, compiled, { mode })` from `@texuli/tokens/design-system/apply`: one style write; calling it again switches in one pass; the returned dispose restores the element. Several design systems on one page each get their own element |
| Svelte | `<DesignSystemProvider {compiled} {mode}>` from `texuli/design-system`: a scope element plus the component defaults context |
| Server HTML | `designSystemStyle(compiled)` returns the same declarations as CSS for `<head>` (`[data-tx-ds="<id>"]`, dark on `[data-tx-mode="dark"]`) |
| No flash | `cacheAppearance(namespace, designSystemAppearance(compiled, { mode }))`, then `noFlashScript(namespace)` replays the map on `<html>` before first paint ([tokens-no-flash](../packages/tokens/docs/tokens-no-flash.md)) |
| Astro | `texuli({ designSystem: { compiled } })` inlines `designSystemStyle` in every page's `<head>` with its CSP hash ([integration](../packages/astro/docs/integration.md#design-system-style)) |
| Blueprints | The envelope's `designSystem` (`{ "ref": "acme@2.1.0" }`, `{ "ref": "texuli:ocean" }` or `{ "inline": { … } }`); `<Player designSystems={{ resolve, mode }}>` resolves a ref through the host (never a fetch), compiles lazily and applies it to the root; a refused one paints with the default theme and a visible notice. `@texuli/pages`' `PageReader` does the same for documents. `blueprint.theme` sets the field and validates |
| Stylesheets and tools | `emitCss` (scoped, `.dark` / attribute / media dark), `emitTailwindPreset`, `emitDtcgJson`, `emitTokensStudio`, `emitRolePalette`, `emitReportHtml` (a static review page) |

The three ways (server style, client apply, no-flash replay) produce
byte-identical variable maps; a test compares them. Every value passes a
filter (no `;`, braces, `url(`, `var(`, comments, control or bidi
characters), so a tampered cache cannot inject CSS. Overlays follow the
scope: portaled dialogs mount in a scoped portal root.

## Override: patches and variants

- **Patches** (`DesignSystemPatch`): the sections only, every field
  optional. `validateDesignSystemPatch(patch)` checks it;
  `applyDesignSystemPatch(base, patch)` merges it: objects merge, arrays
  and scalars replace, `null` removes a field or a map entry. Validate the
  result again (the compiler does when you pass `patches`).
- **Variants**: up to 16 named partial documents under `variants`
  (`high-contrast`, `compact`, a season), orthogonal to mode: every variant
  compiles for light and dark. `compileDesignSystem(doc, { variant:
  "compact" })`.
- **Precedence**: override (patches, in order) > variant > `extends` (the
  deepest base first). Identity always comes from the top document.

```ts
const accented = compileDesignSystem(doc, {
  variant: 'high-contrast',
  patches: [{ color: { brand: { accent: '#b91c1c' } } }],
});
```

## Version and migrate

- `version` is strict semver: bump it when the brand changes; `ds.diff`
  (`texuli ds diff before.json after.json`) lists every changed variable
  per mode, contrast regressions and changed component defaults, for
  review.
- `formatVersion` is the schema version (`1` today).
  `migrateDesignSystem(doc)` is pure and total: it returns `{ ok: true,
  document, from, to, applied }` or a `format-version` error, and never
  throws, so a saved document never bricks an app. `DESIGN_SYSTEM_MIGRATIONS`
  is empty for `formatVersion` 1.
- `extends` names an exact `id@x.y.z` (resolved by the host) or
  `texuli:<theme>`; never a range.

## Distribute

A design system is a JSON file. Put it next to the code that uses it
(`design-systems/<id>.ds.json`), or publish it as an npm package that
exports the document (and, optionally, its cached compiled form):

```json
{
  "name": "@example/brand",
  "version": "2.1.0",
  "type": "module",
  "files": ["design-system.json", "design-system.compiled.json"],
  "exports": {
    "./design-system.json": "./design-system.json",
    "./design-system.compiled.json": "./design-system.compiled.json"
  },
  "peerDependencies": { "@texuli/tokens": "^0.14.0" }
}
```

Keep the package `version` equal to the document's `version`, so
`extends: "brand@2.1.0"` and the package agree; a host's resolver maps the
ref to the import. A hosted registry is out of scope (**planned**, read-only
at most).

## Migrate from themes

Every Texuli `Theme` (a library theme or one made with the generator) is a
design system already:

- `extends: "texuli:<id>"` starts from a library theme; the child changes
  only what differs (a new seed regenerates the palette).
- `fromTheme(theme)` (`@texuli/tokens/design-system/compile`) turns any
  `Theme` into a valid document; `fromThemeWithReport` lists the fields the
  closed vocabulary cannot carry (custom interaction states, a radius over
  48 px, an unnamed easing, component hooks). From `0.11.4` the document
  always compiles: a role pin below the compiler's contrast guarantees is
  dropped so the compiler derives that role, and the drop is listed too. A test compiles all 210
  library themes both ways and checks every variable `themeVariables`
  writes is equal.
- `applyTheme(el)` and `compileThemeCss` keep working; a design system is
  an addition, not a replacement.

## Guarantees

The compiler enforces
([ADR-022](DECISIONS.md#adr-022-design-system-guarantees-enforced-never-reported)),
in every mode and variant:

- text pairs at the declared target (AA 4.5:1 or AAA 7:1), strong borders
  and inputs at 3:1;
- the focus ring at 3:1 against the page and the surface, at least 2 px
  wide;
- interactive targets at `accessibility.targetMin` (control heights are
  lifted to it; a pinned smaller size is refused);
- from spec `0.11.0`, every product token with an on-color
  (`--tx-ext-<name>-foreground` on `--tx-ext-<name>`) at the text target,
  and body text on a soft fill (`--tx-<role>-soft-body`, or the page
  foreground without it) at the text target.

It moves unpinned colors along their own hue to meet a pair and records
every move in `report.adjustments`; it refuses only what pins make
impossible. `checkDesignSystemGuarantees(compiled)` re-checks a cached
compiled map without the compiler.

From spec `0.12.0` (new in `0.14.0`), the sidebar's active fill is derived
whenever it is not role-pinned and would vanish on the sidebar, and
`checkDesignSystemIndicators(compiled)` (on
`@texuli/tokens/design-system/compile` and `compile-core`) checks it at
3:1 against the sidebar (`aa-non-text`). That check is not a compiler
guarantee: when the pins leave no 3:1 fill that keeps the primary ink
readable, the compile succeeds with an `aa-non-text` warning, and
`texuli ds check` and `ds.validate` refuse it.

## Conformance

```bash
texuli ds check examples/design-systems/tumbletown.json --json     # stable codes, exit 0 or 1
texuli ds check examples/design-systems/tumbletown.json --render   # paints the catalog in chromium
```

`--render` paints every agent-emittable catalog component under the design
system in headless chromium and checks axe, the painted contrast of every
pair (from spec `0.12.0` also the sidebar's active fill on the sidebar)
and colors that do not come from the design system. It paints the
conformance sheet that ships inside `@texuli/tools`, so it runs in any
project with `playwright` and `@axe-core/playwright` installed (the command
names the packages when they are missing). In a CI job,
`@texuli/tools/ds-check` runs the same checks from your own tests
(`checkDesignSystem` for the static half, `runDsRenderChecks` on a page you
opened). Details: [ds-check.md](../packages/tools/docs/ds-check.md).

## Locked design systems

> **Status: built, not published.** Blueprint spec `0.13.0`
> ([ADR-032](DECISIONS.md#adr-032-locked-design-systems)). Every item below
> marked built has tests on the plan branch; items marked **planned** do
> not exist yet. Existing documents are unaffected: without `allow` a design
> system is not locked, and a `0.12.0` document compiles to the same CSS.

A locked design system says which Texuli components, variants, sizes and
states a product may use, which components of its own it has, and who
approved that version. Three optional sections of the same document carry
it, so one file and one hash cover the whole policy.

### The allowed set: `allow`

```json
{
  "allow": {
    "button": { "variants": ["default", "outline"], "sizes": ["sm", "md"], "states": [] },
    "card": {},
    "input": { "sizes": ["md"] }
  }
}
```

- The keys are catalog component ids (`packages/spec/catalog/components.json`,
  170 today). Once `allow` exists, a component it does not list is **not
  allowed**.
- Each entry may list `variants`, `sizes`, `tones`, `densities` and
  `states`. An **omitted** list allows every value the catalog lists for
  that component; an **empty** list allows none.
- The catalog says what exists: from spec `0.13.0` each component carries
  its `axes` (`variant`, `size`, `tone`, `density`, each with the enum prop
  that drives it, its values and its default) and its `states`, from the
  closed list `hover`, `focus-visible`, `active`, `disabled`, `loading`,
  `invalid`, `selected`, `expanded`, `checked`, `open`, `readonly`
  ([contract](../packages/spec/docs/contract.md)).
- Catalog membership is checked by `checkDesignSystemAllow(doc, catalog)`
  (`@texuli/spec/design-system`), which takes the catalog as data so the
  bundled validator never carries it, and by `texuli ds check` (codes in
  the [Validate](#validate) table).
- `extends`, variants and patches: entries inherit from the base; a child
  that lists an axis **replaces** that list (it narrows explicitly), keeps
  the lists it does not mention, and `null` in a patch removes an entry.
- A disabled variant is **flagged, never removed at runtime**: component
  code and the emitted CSS are the same under every design system.

### The design system's own components: `library`

```json
{
  "library": [
    {
      "id": "kpi-strip",
      "name": "KPI strip",
      "purpose": "A row of figures for the day's ledger.",
      "version": "0.1.0",
      "status": "draft",
      "composes": ["card", "button"]
    }
  ]
}
```

At most 64 entries. `composes` names the allowed catalog ids the entry is
built from. The code lives with the consumer (for example a
`design-systems/<id>/components/` folder); Texuli validates the declared
entry, the consumer checks the code against it. An entry has its own
`status` and, once approved, its own `approval`.

### Approval and the content hash

```json
{
  "approval": {
    "status": "approved",
    "approvedBy": "Design reviewer",
    "approvedAt": "2026-11-09T14:30:00Z",
    "version": "1.2.0",
    "contentHash": "<64 hex characters>"
  }
}
```

- `contentHash` is the SHA-256 of the canonical JSON (sorted keys, no
  whitespace) of the document **without its `approval`**, with every
  library entry also without its own `approval`
  (`designSystemContentHash`, `libraryEntryContentHash`). Approving an
  entry never moves the document hash; any other edit does.
- `approval` belongs to the top document only: it is never inherited
  through `extends`.
- An `approved` document needs `approvedBy` and `approvedAt`
  (`approval-invalid` otherwise).

**The CLI cannot prove who approved.** `approvedBy` is text anyone can
type, and `texuli ds approve` records it; it does not authenticate it. The
guarantee is a human git commit of the document, reviewed by the design
system's owners through `CODEOWNERS`, for example:

```text
# .github/CODEOWNERS
/design-systems/  @example-org/design-reviewers
```

with branch protection that requires their review. The content hash makes
the approved bytes checkable afterwards: `texuli ds check` refuses a
document edited after approval (`content-hash-mismatch`).

### The commands

```bash
texuli ds init brand.ds.json --locked --preset minimal   # a draft with an allow section (minimal, all or a JSON file)
texuli ds approve brand.ds.json --by design-reviewer      # validates, then stamps approval and contentHash
texuli ds hash brand.ds.json                             # prints the hashes; exit 1 when a stored one differs
texuli ds check examples/design-systems/ledgerline.json  # allowed set, approval, hashes, guarantees
```

- `ds init --locked` writes `approval: { status: "draft" }`; the `minimal`
  preset is `MINIMAL_LOCKED_COMPONENTS` (actions, form controls, text and
  status, containers, overlays and page layouts), `all` is the whole
  catalog.
- `ds approve` is the one door that writes an approved document. Agents
  cannot: `ds.save` refuses a document or library entry marked approved
  (`approval-human-only`), and the `create-design-system` prompt keeps
  approval as a draft and hands it to a person.
- `ds check` checks `allow` against the agent catalog (`--catalog
  <components.json>` for another one), reports the allowed set, the
  approval as declared and each hash, and exits 1 on any refusal
  ([ds-check.md](../packages/tools/docs/ds-check.md)).
- Agents list a valid `allow` section with `ds.allow` (from a preset or
  named ids, with every axis and state the catalog declares).

The three example brands are locked drafts: each has an `allow` section, a
library entry and `approval.status: "draft"`.

### The allow manifest

The compiler emits an **allow manifest** beside the CSS, as
`compiled.allowManifest` (and in `texuli ds compile --format json`):

| Field | Meaning |
| --- | --- |
| `allow` | The effective allowed set after `extends`, variants and patches (absent when not locked) |
| `library` | Each library entry's `id`, `version` and `status` |
| `version` | The document's version |
| `contentHash` | `designSystemContentHash` of the document as written |
| `specVersion` | The blueprint spec the manifest follows (`0.13.0`) |
| `catalogDigest` | The catalog hash, when the caller passed one |

`emitCss` never reads it, so a document with or without `allow` compiles
to the same stylesheet. Checkers and consumers read the manifest instead of
re-resolving the document.

### Exact version pinning

A consumer pins one exact design-system version: `extends` and blueprint
`ref`s take only an exact `id@x.y.z` (a range is `extends-range`), and the
allow manifest carries `version` and `contentHash`, so a binding can refuse
a manifest that is not the one it pinned. Moving to a new version is an
explicit step on the consumer's side (for Protoyard, its own command);
Texuli's part is `ds.diff`, the hashes, and the kit's change list between
two versions (below).

### Mapping rendered elements to components

Every catalog component root carries `data-tx-component="<catalog id>"`
and, where the component has the axis, `data-tx-variant`, `data-tx-size`,
`data-tx-tone` and `data-tx-density`. The names and
`dsRootAttributes(id, axes)` come from `@texuli/spec/design-system`.
Components with no element of their own (`inline-text`,
`data-dashboard-widget`) are the documented exceptions. A checker maps any
element back to its component without component internals.

### Locked-mode rules for consumers

These are the owner's rules for locked prototypes. Texuli states them here
as the contract; the checker that enforces them in Texuli is **planned**
(`@texuli/tools/ds-check`, `0.16.0`).

- **Only allowed components.** UI is built from components in the allow
  set and the design system's own library; no local styled components, no
  restyled controls.
- **Layout-only utilities.** Allowed, on the token scale only: `display`
  (flex, grid, block, inline, hidden), flex direction, wrap, grow, shrink
  and basis, grid columns, rows, span and flow, align, justify, place and
  order, gap, padding, margin, space-x/y, width, height, min/max and size,
  position and inset, overflow, z-index from tokens, and `sr-only`.
  Forbidden: color, background, border, ring, outline, radius, shadow,
  typography (font, text size, weight, leading, tracking), opacity,
  filters, transforms, transitions, and **any arbitrary value**.
- **Charts, maps and canvas.** Exempt from the per-pixel computed-style
  check, because their marks are data; they must still be catalog
  components fed by the design system's data-viz palette and tokens, and
  their chrome (legends, axis text, controls) is checked like any other
  component.
- **Existing prototypes.** Only new prototypes are locked; existing ones
  migrate on demand, and a report mode lists violations without failing
  (**planned** with the checker).
- **Render check.** Required in CI for locked prototypes, on demand
  locally. `texuli ds check --render` already paints the catalog under a
  design system (axe, painted contrast, colors that do not come from it);
  the locked-mode runtime checks are **planned**.

### See the whole design system

`texuli/ds-kit` renders a design system on one page from data: the
foundations (every token, light and dark), voice and rules, the library
with its approval badges, and the changes between two versions, with the
approval record and its hash check in the header. It is **in
development** (`0.16.0`); the component matrix and the texuli.com kit page
are **planned**. The decision is recorded in ADR-032.

## Outputs

| Output | How | Status |
| --- | --- | --- |
| CSS, Tailwind preset, compiled JSON, DTCG, Tokens Studio, role palette | `@texuli/tokens/design-system/emit`, `ds.compile`, `texuli ds compile` / `export` | Released in `0.10.0` |
| A static review page and an SVG snapshot | `emitReportHtml`, `ds.preview` (deterministic: fixed fonts, no time) | Released in `0.10.0` |
| Email | `designSystem` on `@texuli/tools/email` (colors, fonts, radius, spacing, a dark head rule) ([email](../packages/tools/docs/email.md#design-systems)) | Released in `0.10.0` |
| PDF | `designSystem` on `@texuli/tools/print` ([print](../packages/tools/docs/print.md)) | Released in `0.10.0` |
| DOCX, PDF of documents | `design` (plain values from `designValues(compiled, mode)`) on `@texuli/document`'s writers ([docx](../packages/document/docs/docx.md)) | Released in `0.10.0` |
| PPTX | `design` on `@texuli/slides/export` ([export](../packages/slides/docs/export.md)) | Released in `0.10.0` |
| Canvas SVG and PNG | `design` on `@texuli/canvas/export` ([export](../packages/canvas/docs/export.md)) | Released in `0.10.0` |
| Kotlin (Compose) | `packages/spec/scripts/design-tokens.ts` writes `DesignTokens.kt` for the default and `acme` sets, checked by `DesignTokensConformanceTest` ([native](../native/README.md#design-tokens-adr-024)) | Released in `0.10.0`; a CLI command for your own brand is **planned** |
| Standalone decks naming a design system, and Markdown carrying it | `designSystem` on a `@texuli/deck` deck ([model](../packages/deck/docs/model.md#design-systems), [Markdown front matter](../packages/deck/docs/markdown.md#frontmatter)), applied by the `@texuli/slides` stage through `@texuli/player/design-system` ([stage](../packages/slides/docs/stage.md#design-systems)); `designSystem` front matter on `@texuli/document` Markdown ([markdown](../packages/document/docs/markdown.md#design-system-front-matter)); the document DOCX and PDF writers report `design-system-unapplied` for a ref they were not given compiled values for | Released in `0.10.0` |
| Design System Studio on texuli.com | [`/theme-studio/`](../apps/website/docs/site-theme-studio.md) | Released in `0.10.0` |
| The design systems hub on texuli.com: the example brands on four surfaces and their conformance | [`/design-systems/`](../apps/website/docs/site-design-systems.md) | Released in `0.10.0` |

## Agents

| Need | Operation (MCP and `texuli <group> <verb>`) |
| --- | --- |
| Check a document | `ds.validate` |
| Compile or export | `ds.compile` (`json`, `css`, `tailwind`, `dtcg`, `tokens-studio`) |
| Contrast report | `ds.contrast` |
| Start from colors or a logo | `ds.suggest` |
| Import tokens or a theme | `ds.import` |
| Review a change | `ds.diff` |
| A snapshot to show | `ds.preview` (`svg` or `html`) |
| Put it on a blueprint | `blueprint.theme` (then `blueprint.validate`) |
| Save to a file (local server and CLI only) | `ds.save` |

Resources: `texuli://design-system/{id}` (the examples above and every
library theme as a document). Prompt: `create-design-system`. Every edge
operation answers byte-identically on the local server (`npx -y
@texuli/mcp`) and the remote one (`https://texuli.com/mcp`, deployed from `main`). Details: [ds.md](../packages/tools/docs/ds.md).
