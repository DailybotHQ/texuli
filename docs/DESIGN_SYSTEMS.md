# Design systems

> **Status: released in `0.10.0`.** Everything on this page (the
> document, the compiler, the runtime, the importers and emitters, the
> `ds.*` operations, `texuli ds` and the example brands) ships in the 0.10
> line on npm; 0.9.0 had none of it (it has token contract v2, component
> tokens, hooks and design defaults, the plumbing this builds on). Items
> marked **planned** are not built yet.

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
surface). Reference docs: [the document](../packages/spec/docs/design-system.md),
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
| Apply | `@texuli/tokens/design-system/apply` (1,966 B gzip), `texuli/design-system` | The compiled variables of one design system |

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
`assets`, `voice`, `accessibility`, `variants`). Every object is closed,
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
| `aa-text` | A text pair below the target (4.5:1 AA, 7:1 AAA), or a strong border or input below 3:1, that only pins can fix | Unpin one of the colors the hint names, or pick a darker or lighter pin |
| `aa-focus` | The focus ring below 3:1 against the page or surface, or `focusWidth` under 2 px | Unpin `ring` or widen the focus |
| `target-size` | A pinned component size below `accessibility.targetMin` | Pick a size at or above the target |

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
  "peerDependencies": { "@texuli/tokens": "^0.10.0" }
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
  48 px, an unnamed easing, component hooks). A test compiles all 210
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
  lifted to it; a pinned smaller size is refused).

It moves unpinned colors along their own hue to meet a pair and records
every move in `report.adjustments`; it refuses only what pins make
impossible. `checkDesignSystemGuarantees(compiled)` re-checks a cached
compiled map without the compiler.

## Conformance

```bash
texuli ds check examples/design-systems/tumbletown.json --json     # stable codes, exit 0 or 1
texuli ds check examples/design-systems/tumbletown.json --render   # paints the catalog in chromium
```

`--render` paints every agent-emittable catalog component under the design
system in headless chromium and checks axe, the painted contrast of every
pair and colors that do not come from the design system. In a CI job,
`@texuli/tools/ds-check` runs the same checks from your own tests
(`checkDesignSystem` for the static half, `runDsRenderChecks` on a page you
opened). Details: [ds-check.md](../packages/tools/docs/ds-check.md).

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
