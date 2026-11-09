# Design-system conformance: `texuli ds check` and `@texuli/tools/ds-check`

> **Status: released in `0.10.0`.** The command and the
> `@texuli/tools/ds-check` and `@texuli/tools/ds-check/host` subpaths ship
> in `@texuli/tools@0.10.0` (PLAN_011 T-ds-conformance). The `ds.*`
> operations and the other `texuli ds` commands are in [ds.md](ds.md).

`texuli ds check` tells you whether a design-system document
([`@texuli/spec/design-system`](../../spec/docs/design-system.md)) holds
Texuli's guarantees, with the spec's stable codes and JSON paths, so a CI
job can fail on a refusal and show the field to fix. `--render` also paints
the catalog components under the design system in a headless browser and
checks what the browser actually shows.

```bash
texuli ds check acme.json                       # static checks, a summary, exit 0 or 1
texuli ds check acme.json --json                # the same as a stable JSON report
texuli ds check acme.json --render              # plus axe, painted contrast and literal colors (the built-in sheet)
texuli ds check acme.json --render --sheet site/sheet.html   # a sheet page you built
texuli ds check child.json --base base.json     # extends: "base@1.2.3" from a local file
texuli ds check acme.json --mode dark --variant compact
texuli ds check brand.json --catalog components.json   # allow checked against another catalog
```

> **Locked design systems (spec 0.13.0, new in `0.15.0`).** The check also
> reports the allowed set, the approval and the content hashes
> ([below](#locked-design-systems)); it cannot prove who approved.

## Flags

| Flag | Meaning |
| --- | --- |
| `<file>` | The design-system document (JSON, at most 1 MB) |
| `--json` | Print the report as JSON (below) instead of a summary |
| `--mode light\|dark\|all` | The modes to check (default `all`: every mode the document compiles) |
| `--variant <name>` | A variant to check besides the base, repeatable. Default: `high-contrast` when the document declares it. A name the document does not declare is refused as `invalid-value` at `$.variants` |
| `--trust developer\|untrusted` | The validator's trust level (default `untrusted`, which refuses every `data:` URL; `developer` accepts capped ones) |
| `--base <file>` | A document that `extends: "id@x.y.z"` names, keyed by its own `id` and `version`; repeatable. `texuli:<id>` bases load from the theme library |
| `--render` | Add the render checks (below) |
| `--sheet builtin\|<page.html>` | With `--render`: the sheet to paint. `builtin` (the default) is the conformance sheet that ships inside `@texuli/tools`; a path is a built HTML page that installs the host, served with the files of its folder (below) |
| `--url <page>` | With `--render`: check a page you serve yourself instead of a sheet (not with `--sheet`) |
| `--known <file>` | With `--render`: a JSON array of findings you track, `[{ "component", "element", "property", "reason" }]` (at most 1 MB and 500 entries; `component` may be `*`, `element` and `property` are prefixes). They are reported as `known` and do not fail the run. A malformed list exits 2 |
| `--strict` | With `--render`: known findings fail too |
| `--catalog <components.json>` | The catalog `allow` is checked against (`{ components: [{ id, axes?, states? }] }`, for example `@texuli/spec`'s `catalog/components.json` or a stub). Default: the agent catalog `@texuli/tools` builds. A file without a `components` list exits 2 |

**Exit codes:** `0` every check passed; `1` a refusal or a render finding;
`2` the check could not run (a bad flag, an unreadable or non-JSON file, or a
missing `--render` requirement).

## Static checks (always)

1. The spec's validation at the chosen trust level, with migration (codes
   `unknown-key`, `invalid-type`, `invalid-value`, `required`,
   `format-version`, `extends-range`, `url-refused`, `inline-bytes`).
2. The `extends` chain (`extends-cycle`, `extends-depth`, and
   `invalid-value` at `$.extends` for a base nothing resolves).
3. The compile of the base document and each checked variant
   (`compileDesignSystem`), which enforces the guarantees (`aa-text`,
   `aa-focus`, `target-size`, with the failing pairs and every pinned path in
   `hint`).
4. The guarantees re-checked over the compiled variables
   (`checkDesignSystemGuarantees`), so a compiled map that slipped a
   guarantee is refused too.
5. From spec `0.12.0` (new in `0.14.0`, D-G-029), non-text contrast
   (WCAG 1.4.11, `checkDesignSystemIndicators`): the sidebar's active fill
   (`--tx-sidebar-primary`) at 3:1 against the sidebar fill. Below it, the
   run is refused with `aa-non-text` at `$.vars.<mode>["--tx-sidebar-primary"]`.
   The compiler derives an active fill the document does not pin, so this
   catches a `color.roles.<mode>.sidebarPrimary` pin (or pins that leave no
   3:1 fill) that would paint an invisible active item. The compiler also
   lists `primary` on `background` below 3:1 in the run's `warnings` with
   the same code; that one is advisory (a filled button is identified by its
   label) and does not fail the run.

6. Spec `0.13.0` (locked design systems, ADR-032): the `allow` section and
   `library[].composes` against the catalog (`checkDesignSystemAllow`:
   `unknown-component`, `unknown-variant`, `unknown-size`, `unknown-tone`,
   `unknown-density`, `unknown-state`), then the content hash each approval
   records (`content-hash-mismatch` at `$.approval.contentHash`,
   `library-hash-mismatch` at `$.library[<i>].approval.contentHash`).

Every run reports its contrast pairs per mode (with ratio and requirement),
the solver's adjustments, the warnings, the inline bytes and the targets.

## Locked design systems

Every report has a `locked` section, and the summary prints it:

```text
  locked: 2 components allowed (checked against the catalog)
  library: primary-cta
  approval: approved (version 1.2.0, declared by design-reviewer, at 2026-11-09T12:00:00Z)
  content hash 9f3c…: matches the approval
  library primary-cta: approved, hash matches
```

| Field | Meaning |
| --- | --- |
| `locked` | The document has an `allow` section |
| `allowed` | The allowed catalog ids, sorted (empty when not locked) |
| `library` | The library entry ids |
| `catalogChecked` | `allow` was checked against a catalog (always, from the CLI) |
| `approval` | `status` (`approved`, `draft`, `none` or `unknown`), `version`, `approvedBy` and `approvedAt` **as declared**, the computed `contentHash`, and the `stored` hash with `matches` when one is recorded |
| `entries` | Each library entry's `id`, `status`, `contentHash`, `stored` and `matches` |

A draft is reported, never refused. A recorded hash that no longer matches
is refused: the document (or entry) changed after it was approved; review
the change and approve again (`texuli ds approve`). **The check cannot
prove who approved**: `approvedBy` is text the approver typed. The
guarantee is a human commit of the document reviewed through `CODEOWNERS`
([DESIGN_SYSTEMS](../../../docs/DESIGN_SYSTEMS.md#approval-and-the-content-hash)).
`texuli ds hash <file>` prints the same hashes ([ds.md](ds.md)).

In your own code, `checkDesignSystem(doc, { catalog, hashes: true })` gives
the same report; without `hashes` a stale approval is reported in
`locked.approval.matches` but not refused (that is how `ds.validate` and
`ds approve` call it: re-approving is what fixes a stale hash).

## The JSON report

```jsonc
{
  "format": "texuli/ds-check", "version": 1,
  "ok": false,
  "file": "acme.json",
  "document": { "id": "acme", "version": "2.1.0", "name": "Acme" },
  "codes": ["aa-text"],                       // the distinct codes, sorted
  "errors": [{ "code": "aa-text", "path": "$.color.roles.light.foreground",
               "message": "…", "hint": "…", "mode": "light", "variant": "high-contrast",
               "pairs": [{ "foreground": "--tx-foreground", "background": "--tx-background",
                           "kind": "text", "ratio": 1.2, "required": 4.5, "pass": false }] }],
  "runs": [{ "variant": null, "ok": true, "modes": ["light", "dark"], "hash": "…",
             "contrast": { "light": [/* every pair */] }, "adjustments": [], "warnings": [],
             "inlineBytes": 0, "targets": [] }],
  "render": { "ok": true, "url": "…", "runs": [/* with --render, below */] },
  "locked": { "locked": true, "allowed": ["button", "card"], "library": [], "catalogChecked": true,
              "approval": { "status": "draft", "version": "2.1.0", "contentHash": "…" },
              "entries": [] }
}
```

`variant`, `mode`, `source` (an `extends` ref, `variant:<name>` or
`patch:<i>`), `hint` and `pairs` appear only when they apply. The shape
changes only with a new `version`.

## `--render`

The render checks paint every **agent-emittable** catalog component (75 of
the 170 manifests; the 95 app-tier components, such as overlays and app
chrome, are not painted by the player and are not on the sheet), each from
its first manifest example through `@texuli/player`, inside one scope. For
the base document and each checked variant, in each mode, the driver applies
the compiled design system to that scope (`applyDesignSystem`) and asserts:

- **axe** (WCAG 2.0 to 2.2, A and AA, scoped to the sheet): code `render-axe`;
- **painted contrast:** every pair of the compiled report, and from spec
  `0.12.0` the sidebar's active fill on the sidebar (3:1), painted through
  the cascade inside the scope and measured from the computed colors, meets
  its requirement: code `render-contrast` at the foreground's
  `$.vars.<mode>["--tx-…"]`;
- **no literal colors:** every painted color (text, background, visible
  borders and outlines, SVG fill and stroke) is read twice, once with the
  design system and once with every color variable of the scope inverted. A
  color that does not move does not come from the scope's `--tx-*`
  variables: a literal, a system-color fallback of a variable outside the
  contract, or a variable resolved outside the scope. Code `render-literal`
  at `$.render["<catalog id>"]`. Elements that paint no pixel are skipped:
  hidden ones, and the visually-hidden pattern (`clip-path: inset(50%)` or
  `clip: rect(0 0 0 0)`) with its subtree, such as a select's form-bridge
  input or screen-reader text;
- a sheet that painted nothing: `render-empty`.

**Known findings.** The library tracks none: `DS_CHECK_KNOWN_FINDINGS` is
empty. The first conformance run found 12 (player cards, slides and tiles
and the dashboard widget read `--tx-card`, the link preview and structure
block read `--tx-color-*`, `player.css` read `--tx-danger`, and the native
player controls painted the user agent's colors); T-ds-conformance fixed
each at its root and `scripts/check-token-usage.ts` now refuses their
causes (a system color outside a forced-colors block, a `--tx-*` name
nothing defines). The mechanism stays for adopters: pass your own list with
`known` (or `--known <file>`); each match is reported as `known` in its
render run and does not fail it, and `--strict` makes it fail, so a CI job
can still see what it tracks. The repository's conformance spec fails when
a library entry is no longer found, so the list cannot rot.

**Requirements.** `--render` uses the Playwright of the project it runs in,
resolved from the working directory first (so a strict pnpm install, where
`@texuli/tools` cannot see your dev dependencies, still finds it):
`playwright` (or `@playwright/test`) with chromium installed
(`npx playwright install chromium`), and `@axe-core/playwright`.
`@texuli/tools` does not depend on them. Without them the command exits 2
and names the exact packages, for example:

```text
texuli ds check --render needs "playwright" and "@axe-core/playwright", which are not installed in this project. Install them as dev dependencies (npm install --save-dev playwright @axe-core/playwright; "@playwright/test" also works in place of "playwright"), then run "npx playwright install chromium". @texuli/tools does not depend on them, and the static checks run without them.
```

A Playwright without its chromium build also exits 2, with
`npx playwright install chromium` to run. The static checks never need any
of them.

**The sheet.** The published `@texuli/tools` ships the conformance sheet at
`dist/ds-check/sheet/` (`ds-conformance.html`, one script, one stylesheet,
every catalog component and theme bundled in, and `THIRD_PARTY_NOTICES.md`,
the license notices of the bundled dependencies), and `--render` serves it by
default (`--sheet builtin`) from a read-only static server on `127.0.0.1`.
It needs no bundler and no other Texuli package at run time, so it runs in
any project that installs `@texuli/tools` from npm. `pnpm verify:packages`
(which the publish workflow runs) builds it from the repository's
`tests/fixtures/app/ds-conformance.html` with `scripts/ds-check-sheet.ts`,
so it is the page the repository's conformance spec drives. A source
checkout has no built sheet; there `--sheet builtin` serves the fixture app
with the repository's Vite instead.

To paint your own components, build a page that renders them inside one
element and installs the host, then pass it with `--sheet <page.html>`
(served with the files of its folder: GET only, nothing outside it) or
serve it yourself and pass `--url <page>`:

```ts
import { installDsCheckHost } from '@texuli/tools/ds-check/host';

// Each component sits in an element with data-ds-check-component="<id>".
installDsCheckHost(document.getElementById('sheet')!, { ready: () => allPainted() });
```

The host exposes `window.texuliDsCheck` (`ready`, `apply`, `inspect`),
switches off transitions and animations inside the scope, and builds no
markup from strings.

## In your own tests

```ts
import { checkDesignSystem, runDsRenderChecks } from '@texuli/tools/ds-check';

const report = await checkDesignSystem(doc, { bases: { 'base@1.2.3': base } });
expect(report.codes).toEqual([]);

// With a Playwright page already on a sheet that installs the host:
const runs = await runDsRenderChecks(page, report.runs, { axe: myScopedAxe });
expect(runs.every((run) => run.ok)).toBe(true);
```

| Export | What it does |
| --- | --- |
| `checkDesignSystem(doc, { modes?, variants?, trust?, bases?, file? })` | The static report (above); never throws on a JSON value |
| `serializeDsCheckReport(report)` | The report without the compiled maps (what `--json` prints) |
| `runDsRenderChecks(page, runs, { modes?, axe?, known?, strict?, timeoutMs? })` | The render runs on a page that installs the host |
| `renderDesignSystemCheck(report, { sheet?, url?, cwd?, load?, … })` | Launches chromium, serves the sheet (`builtin` by default) and adds `render` to the report; throws `DsCheckRequirementError` when a requirement is missing |
| `resolveDsCheckSheet(sheet?, { cwd?, builtinDir? })`, `builtinSheetDir()`, `serveSheetDirectory(dir, page?)`, `startDsCheckSheet(source)` | Where a `--sheet` value points (the packaged sheet, the repository's fixture app in a source checkout, or a built page), and the read-only static server |
| `loadRenderModules(load?)`, `projectModuleLoader(cwd?)`, `missingRenderPackagesMessage(names)`, `DS_CHECK_PLAYWRIGHT_PACKAGES`, `DS_CHECK_AXE_PACKAGE` | Load Playwright and axe from the project, or fail with the exact packages to install |
| `renderIssues(run)` | One run's findings as report issues |
| `playwrightAxeRunner(cwd?)` | An axe runner over `@axe-core/playwright`, scoped to the sheet |
| `DS_CHECK_KNOWN_FINDINGS`, `knownFinding(literal, known?)`, `parseKnownFindings(value)` | The tracked library findings (none), the matcher, and the validator of a `--known` list |
| `runDsCli(argv, io?)`, `parseDsCliArgs(argv)`, `formatDsCheckReport(report)` | The CLI |
| `installDsCheckHost(scope, { ready? })` (`/ds-check/host`) | The in-page half |

## Tests

- `packages/tools/tests/ds-check.test.ts`: every refusal code (the spec's
  invalid fixtures and the three guarantees) reaches exit 1 and the JSON
  with its path; flags, exit 2, `--base`, `--variant`, `--mode`, `--known`
  and `--strict`, `--sheet` (the packaged sheet first, a built page, the
  static server's refusals), the exact packages a missing Playwright or axe
  names, and the render findings' codes.
- `scripts/tests/ds-check-sheet.test.ts`: `pnpm verify:packages` builds the
  sheet into `@texuli/tools` at `dist/ds-check/sheet/` as one self-contained
  page with its third-party license notices.
- `tests/e2e/ds-conformance.spec.ts` (chromium): the acme, minimal and
  fictional protoyard-theme/v1 brands and six library themes, every mode,
  with no known finding, plus a planted literal and a broken pair that the
  checks must catch and a planted visually-hidden element they must skip.
