---
name: texuli-design-systems
description: Author, validate, repair, apply and export a Texuli design system (one closed JSON document for a whole brand) — importers, the ds.* MCP operations, texuli ds, stable error codes, blueprint designSystem. New in 0.10.0.
version: "0.4.6"
documentation_url: https://texuli.com/guides/
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
metadata: {"openclaw":{"emoji":"▣","homepage":"https://texuli.com/guides/","requires":{"anyBins":["bash","git"]}}}
---

# Design systems

Use this sub-skill when the developer wants **a brand as data**: one
design-system document (format `texuli/design-system`, `formatVersion` 1)
that every Texuli surface follows: components, the blueprint player,
documents, decks, email, PDF, DOCX, PPTX and canvas. The Kotlin twin decodes
the document and paints with token sets compiled on the web side (no Kotlin
compiler for a brand document yet). For a
quick library theme instead, use [`../themes/SKILL.md`](../themes/SKILL.md).

> **Released in `0.10.0`.** The document, compiler, runtime, importers,
> the `ds.*` operations and `texuli ds` ship from `0.10.0` (install
> `^0.14.0`); the 0.9 line does not have them, so an app pinned to
> `^0.9.0` moves up first ([`../upgrade/SKILL.md`](../upgrade/SKILL.md))
> or stays on themes.

Guide (monorepo): `docs/DESIGN_SYSTEMS.md`. Reference: the document
`packages/spec/docs/design-system.md`, the compiler
`packages/tokens/docs/design-system-compiler.md`, importers and emitters
`packages/tokens/docs/design-system-io.md`, the operations
`packages/tools/docs/ds.md`. Example brands (fictional):
`examples/design-systems/` (`quillmark`, `ledgerline`, `tumbletown`).

## Rules

- **Data only.** Colors are `#rgb`, `#rrggbb`, `#rrggbbaa` or a numeric
  `oklch()`; lengths are numbers in px; everything else is an enum, a font
  name or a relative asset path. Never write CSS strings, `var()`, scripts,
  remote URLs or (from an agent) `data:` URLs.
- **Closed objects.** An unknown key is refused (`unknown-key`); copy field
  names from `texuli://design-system/acme`, which shows every section.
- **Fictional brands only** (`example.com`, "Example Co."); never a real
  company's name, colors or logo.
- **Never claim it passes** without a validator result. For ordinary
  validation, check MCP `valid: true` or CLI exit code 0. In full MCP mode,
  also inspect `summary` and `findings`; in full CLI JSON require `ok: true`.
  A report-only run exits 0 even with findings and is not a passing verdict.
- **Nothing activates.** Saving needs an explicit path (`ds.save`, local
  only); a blueprint stays a `draft` until its owner activates it.

## Author

1. **Generate a draft from proposed inputs.** When the developer supplies
   reference screenshots, inspect them with your own vision capabilities and
   translate observations into a proposed brief or other generator inputs.
   Screenshots are not read or imported by Texuli. Translate observations
   into a brief, then use `ds.generate` with any combination of that brief,
   DTCG or Tokens Studio JSON, CSS text, logo pixels and a Texuli theme. It
   returns a draft plus `report.losses` (dropped or overwritten values),
   `report.repairs` (automatic AA
   adjustments and why) and `report.guarantees`; inspect every entry. Inputs
   are bounded, and CSS is never fetched or executed. The operation does not
   save or approve anything. The CLI equivalent is `texuli ds generate` with
   `--brief`, `--from-tokens`, `--from-css`, `--from-logo` or `--from-theme`
   and `-o <file>`; it writes the document and report.
2. **Start from focused importers when useful** (the MCP tools, or the CLI in a checkout):

   | The developer has | Call |
   | --- | --- |
   | A few words and colors | `ds.import` `{ "from": "brand", "input": "name Example, brand #0e7490, font Inter, rounded, compact" }` |
   | One to three colors | `ds.suggest` `{ "colors": ["#0e7490", "#f59e0b"] }` |
   | A logo | `ds.suggest` `{ "pixels": [r, g, b, a, …] }` (RGBA, at most 128 × 128) |
   | A DTCG or Tokens Studio file | `ds.import` `from` `dtcg` or `tokens-studio` |
   | A flat role palette (light and dark roles) | `ds.import` `from` `role-palette` |
   | A Texuli theme | `ds.import` `{ "from": "theme", "input": "ocean" }`, or `"extends": "texuli:ocean"` |

   Read every warning: each names a value that was dropped and why. These
   tools remain useful for focused conversions and palette suggestions.
3. **Write only what the brief asks for**: identity (`id` lowercase with
   hyphens, semver `version`, `name`), `color.brand.seed` (plus
   `secondary`, `accent`, `neutral`), then `typography.families`,
   `shape.radius`, `space.density`, `elevation.style`, `motion.personality`,
   `components.<id>.defaults`, `accessibility` (`contrast` AA or AAA,
   `targetMin`). Pin a color (`color.pin.primary`) only when the brand
   requires that exact fill.
4. **Variants** (`high-contrast`, `compact`) are partial documents under
   `variants`; every variant compiles in light and dark.
5. **Spec 0.11.0 fields** (new in `0.13.0`; the `0.10.0` to `0.12.3`
   packages carry spec 0.10.0 and refuse them, so check the installed
   version first): `elevation.levels` (keys `1`–`5`, each 1 to 4 layers of `y`,
   `blur`, `opacity` and optional `x`, `spread`, `inset`; numbers in px,
   never a CSS string), `extensions` (product tokens beyond the roles:
   `{ "brand-gold": { "light": "#fef3c7", "dark": "#78350f", "on": {} } }`
   compiles `--tx-ext-brand-gold` and a checked `-foreground`), and a
   `color.dataViz.<mode>.categorical` of 1 to 8 colors (the compiler
   derives the rest). To give a soft fill its own text color, pin
   `color.roles.<mode>.<role>SoftForeground`: the fill is then held to
   that ink, not to the page text.
6. **Spec 0.12.0** (new in `0.14.0`; `0.13.x` refuses it): a shadow
   layer's optional `darkOpacity` (0 to 1) is its opacity in dark mode,
   `{ "y": 2, "blur": 6, "opacity": 0.12, "darkOpacity": 0.48 }`. Leave
   `color.roles.<mode>.sidebarPrimary` out: the compiler derives the
   sidebar's active fill when the sidebar would hide it; a pinned one that
   vanishes is refused as `aa-non-text`.

## Validate and repair

Call `ds.validate` with `{ "document": … }` (bases for `extends:
"id@x.y.z"` go in `bases`). Fix every error by its `code` and `path`, then
validate again, until `valid` is true. The codes and their fixes:
[`references/codes.md`](references/codes.md). Then call `ds.contrast`: every
mode must report `failing: 0`.

For a locked design system, request the full validator with MCP
`ds.validate` `{ "document": …, "full": true }`. Add `prototype` as bounded
data (`{ "files": { "src/App.svelte": "…" }, "blueprints": { … } }`) to
check source components, static props, blueprints and locked CSS. It reads
source text; it never executes it. `catalog` can replace the bundled
catalog, `extensions` adds checked host catalog entries, and `strict: true`
promotes warnings to errors in `valid`. `report: true` marks a progress
report; findings are always returned and `valid` still carries the verdict.
MCP full mode has no browser runtime check.

In a local checkout, use `texuli ds validate <file> --locked` for full
document validation and `--prototype <dir>` to scan a local prototype tree.
`--json` emits the full report and counts. `--report` prints all findings
and exits 0 for migration tracking, even when the report's `ok` is false;
do not treat that exit code as a pass. `--render` adds Chromium checks for
the catalog conformance sheet, not the consumer application's own page.
CLI `--strict` applies to known findings in that render check. Exit codes:
0 valid or report-only, 1 enforced findings, 2 unable to run. The complete
code, severity, exemption and input-limit reference is
`packages/tools/docs/ds-check.md` in the Texuli repository.

## Lock, review and hand over (locked design systems, in development)

A locked design system also lists what a brand allows (ADR-032). The whole
path, end to end, is the guide's "Create a locked design system, end to end"
section in `docs/DESIGN_SYSTEMS.md`. Your part as an agent:

1. **The allowed set.** Call `ds.allow` with `{ "preset": "minimal" }` (or
   `"all"`, or `{ "components": ["button", "card", …] }`). It returns every
   variant, size, tone, density and state the catalog declares; narrow the
   lists to the brief and put the result under `allow`. A component not
   listed is not allowed; an omitted list allows every value; an empty list
   allows none. Host library components join as checked catalog
   `extensions` (`<ns>:<id>`) on `ds.validate`.
2. **The library.** Each `library` entry names its id, purpose, version,
   `status: "draft"` and the allowed catalog ids it `composes`.
3. **Validate** with `ds.validate` `{ "document": …, "full": true }` until
   `valid` is true.
4. **Review.** Tell the developer to look at it whole: `texuli/ds-kit` in
   their app, or the example at `https://texuli.com/design-systems/kit/`.
5. **Never approve.** Leave `approval` out (or `status: "draft"`);
   `ds.save` refuses an approved document (`approval-human-only`). Hand the
   next step to a person: review the file, run
   `texuli ds approve <file> --by <name> --version <x.y.z>` and commit it
   for the CODEOWNERS review. The CLI cannot prove who approved; the
   reviewed commit is the guarantee. Never say a document is approved
   because a file says so.
6. **Hand over.** `ds.bundle` `{ "document": …, "librarySources": […],
   "history": […] }` packs a portable bundle (`{ "bundle": … }` unpacks
   one); the CLI is `texuli ds pack <file> --out <bundle.json>`. Consumers
   pin the exact version and check their prototypes with
   `texuli ds validate <file> --locked --prototype ./src`.

The `create-design-system` prompt takes `locked` (`minimal`, `all` or
`custom`) and stops at a draft.

## Apply and export

| Goal | Call |
| --- | --- |
| A blueprint follows it | `blueprint.theme` `{ "blueprint": <tree or envelope>, "designSystem": { "inline": <document> } }` (or `{ "ref": "id@x.y.z" }`, `{ "ref": "texuli:ocean" }`), then `blueprint.validate` |
| A stylesheet | `ds.compile` `format` `css` (scoped `[data-tx-ds="<id>"]`, `.dark`) or `tailwind` |
| Token files | `ds.compile` `format` `dtcg` or `tokens-studio` (lossless round trip) |
| A review snapshot | `ds.preview` `svg` or `html` (deterministic) |
| A change review | `ds.diff` `{ "before": …, "after": … }` |
| A file in the project | `ds.save` `{ "path": "design-systems/<id>.ds.json", "document": … }` (local server only), or `texuli ds init` |

In app code (a checkout on the branch): `compileDesignSystem` then
`applyDesignSystem(el, compiled, { mode })`, `<DesignSystemProvider
{compiled} {mode}>` from `texuli/design-system`, `designSystemStyle` for
server HTML, the Astro `designSystem` option, or `<Player designSystems={{
resolve, mode }}>` for blueprints. Details: the guide.

## CLI (`texuli ds`, from `0.10.0`)

```bash
texuli ds init design-systems/example.ds.json --name Example
texuli ds validate design-systems/example.ds.json
texuli ds compile design-systems/example.ds.json --format css --out dist/example.css
texuli ds preview design-systems/example.ds.json --out review/example.svg
texuli ds check design-systems/example.ds.json --json
texuli ds validate design-systems/example.ds.json --locked --prototype ./src --json
texuli ds init design-systems/example.locked.ds.json --locked --preset minimal
texuli ds approve design-systems/example.locked.ds.json --by design-reviewer   # a person, then a reviewed commit
texuli ds hash design-systems/example.locked.ds.json
```

Exit codes: 0 valid, 1 refused, 2 could not run. MCP tools, prompt and
resources: [`references/mcp.md`](references/mcp.md).

## Verify (monorepo)

```bash
pnpm vitest run packages/tokens/tests/examples.test.ts
pnpm vitest run packages/tools/tests/ds-ops.test.ts
pnpm vitest run tests/agent-evals
```
