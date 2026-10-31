# Design-system conformance: `texuli ds check` and `@texuli/tools/ds-check`

> **Status: in development for `0.10.0`, not on npm.** The command and the
> `@texuli/tools/ds-check` and `@texuli/tools/ds-check/host` subpaths exist
> on the `release/0.10.0` branch (PLAN_011 T-ds-conformance) and ship only
> with `@texuli/tools@0.10.0`. The MCP `ds.*` operations are **planned**
> (T-ds-agent-tools).

`texuli ds check` tells you whether a design-system document
([`@texuli/spec/design-system`](../../spec/docs/design-system.md)) holds
Texuli's guarantees, with the spec's stable codes and JSON paths, so a CI
job can fail on a refusal and show the field to fix. `--render` also paints
the catalog components under the design system in a headless browser and
checks what the browser actually shows.

```bash
texuli ds check acme.json                       # static checks, a summary, exit 0 or 1
texuli ds check acme.json --json                # the same as a stable JSON report
texuli ds check acme.json --render              # plus axe, painted contrast and literal colors
texuli ds check child.json --base base.json     # extends: "base@1.2.3" from a local file
texuli ds check acme.json --mode dark --variant compact
```

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
| `--url <page>` | With `--render`: check your own page instead of the repository sheet |
| `--strict` | With `--render`: known library findings fail too |

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

Every run reports its contrast pairs per mode (with ratio and requirement),
the solver's adjustments, the warnings, the inline bytes and the targets.

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
  "render": { "ok": true, "url": "…", "runs": [/* with --render, below */] }
}
```

`variant`, `mode`, `source` (an `extends` ref, `variant:<name>` or
`patch:<i>`), `hint` and `pairs` appear only when they apply. The shape
changes only with a new `version`.

## `--render`

The render checks paint every **agent-emittable** catalog component (75 of
the 168 manifests; the 93 app-tier components, such as overlays and app
chrome, are not painted by the player and are not on the sheet), each from
its first manifest example through `@texuli/player`, inside one scope. For
the base document and each checked variant, in each mode, the driver applies
the compiled design system to that scope (`applyDesignSystem`) and asserts:

- **axe** (WCAG 2.0 to 2.2, A and AA, scoped to the sheet): code `render-axe`;
- **painted contrast:** every pair of the compiled report, painted through
  the cascade inside the scope and measured from the computed colors, meets
  its requirement: code `render-contrast` at the foreground's
  `$.vars.<mode>["--tx-…"]`;
- **no literal colors:** every painted color (text, background, visible
  borders and outlines, SVG fill and stroke) is read twice, once with the
  design system and once with every color variable of the scope inverted. A
  color that does not move does not come from the scope's `--tx-*`
  variables: a literal, a system-color fallback of a variable outside the
  contract, or a variable resolved outside the scope. Code `render-literal`
  at `$.render["<catalog id>"]`;
- a sheet that painted nothing: `render-empty`.

**Known findings.** `DS_CHECK_KNOWN_FINDINGS` lists the library findings
that are tracked, each with its reason (player cards and the dashboard
widget read `--tx-card`, the link preview and structure block read
`--tx-color-*`, and a few native player controls are unstyled). They are
reported as `known` in each render run and do not fail it; `--strict` makes
them fail. The repository's conformance spec fails when one is no longer
found, so the list shrinks as the fixes land.

**Requirements.** `--render` uses the Playwright of the project it runs in:
`@playwright/test` (or `playwright`) with chromium installed
(`npx playwright install chromium`), and `@axe-core/playwright`.
`@texuli/tools` does not depend on them. Without them the command exits 2
and names what to install; the static checks never need them.

**The sheet.** Inside the Texuli repository the command serves
`tests/fixtures/app/ds-conformance.html` with the repository's Vite. Outside
it, pass `--url` to a page you serve that renders your components inside one
element and installs the host:

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
| `renderDesignSystemCheck(report, { url?, cwd?, … })` | Launches chromium (and the repository sheet) and adds `render` to the report; throws `DsCheckRequirementError` when a requirement is missing |
| `renderIssues(run)` | One run's findings as report issues |
| `playwrightAxeRunner()` | An axe runner over `@axe-core/playwright`, scoped to the sheet |
| `DS_CHECK_KNOWN_FINDINGS`, `knownFinding(literal)` | The tracked library findings |
| `runDsCli(argv, io?)`, `parseDsCliArgs(argv)`, `formatDsCheckReport(report)` | The CLI |
| `installDsCheckHost(scope, { ready? })` (`/ds-check/host`) | The in-page half |

## Tests

- `packages/tools/tests/ds-check.test.ts`: every refusal code (the spec's
  invalid fixtures and the three guarantees) reaches exit 1 and the JSON
  with its path; flags, exit 2, `--base`, `--variant`, `--mode`, the
  `--render` requirement message, and the render findings' codes.
- `tests/e2e/ds-conformance.spec.ts` (chromium): the acme, minimal and
  fictional protoyard-theme/v1 brands and six library themes, every mode,
  plus a planted literal and a broken pair that the checks must catch.
