# Visual regression

Screenshot baselines for every registered example, in light and dark, on
desktop Chromium and the Pixel 7 (`playwright.config.ts` projects `chromium`
and `mobile`; WebKit is skipped on purpose).

```sh
TEXULI_E2E_PORT=4870 pnpm exec tsx scripts/visual.ts            # pnpm visual: diff and list changed examples
TEXULI_E2E_PORT=4870 pnpm exec tsx scripts/visual.ts --update   # pnpm visual:update: accept the new captures
pnpm exec playwright test tests/visual/visual.spec.ts           # the spec on its own
pnpm vitest run scripts/tests/visual.test.ts                    # the pure half (discovery, names, report)
```

The runner takes `--project chromium|mobile` and `-g <title>`. It writes a
JSON report to `tmp/visual/report.json` and prints:

- **Changed examples:** captures that differ from their baseline.
- **Missing baselines:** a new example, or a first run on this platform.
- **Errors:** anything else, such as an example that never rendered.

It exits 1 when there is anything to review. The diffs (`*-diff.png`) are in
`test-results/`. After `--update`, look at the new PNGs before committing
them.

## What a capture is

- One test per example, color scheme and project, so a failure names the
  example, and every changed example is reported, not just the first.
- **Emulation:** `colorScheme` and `reducedMotion: 'reduce'`. Each capture
  first checks that the page sees the scheme (`prefers-color-scheme`).
- **Stable rendering:**
  - fonts loaded (`document.fonts.ready`) and two animation frames;
  - animations, transitions and the caret frozen;
  - full page, at CSS pixels.
- **Strict comparison:** any pixel beyond Playwright's per-pixel color
  threshold fails. There is no ratio allowance, so one changed word on a
  large page is caught.
- **Baselines:** `visual.spec.ts-snapshots/<id>--<scheme>-<project>-<platform>.png`.
  They are per platform because system fonts differ between machines, so
  baselines recorded on macOS (`-darwin`) don't apply to Linux CI.

## Responsive baselines for the astro examples

Examples tagged `astro` get a second capture set on top of the per-project
one: the full page at explicit viewport widths **360, 768, 1024 and 1440**,
in light and dark. These run on the desktop `chromium` project only — the
`mobile` project skips them (`test.skip`), since it already captures the
example at its own default viewport. Emulation and stability rules are the
same as every capture, including `reducedMotion: 'reduce'`; each test sets
`page.setViewportSize` before capturing, so no new Playwright project is
needed.

Baselines follow `<id>-w<width>--<scheme>-chromium-<platform>.png`
(`astro-site-hero-w360--light-chromium-darwin.png`), which the report's
`parseScreenshotName` still parses. Filter to one example with
`pnpm visual -g <example-id>` — `-g astro` selects the whole responsive
matrix.

## Builder baselines

The website's blueprint builder (`apps/website/src/components/builder/`) is
captured as two fixture-app pages next to `smoke`:
- `builder`: the empty draft;
- `builder-draft`: a fictional report draft with a list block selected, so the
  inspector shows the list editor.

The examples registry may not import website code (`pnpm check:layers`), so
the fixture app (`tests/fixtures/app/src/BuilderFixture.svelte`) mounts the
real `BuilderApp` island directly.

Each page gets the usual light and dark captures on desktop Chromium (1280)
and the Pixel 7 (412), plus a 360 px set on desktop Chromium
(`<id>-w360--<scheme>-chromium-<platform>.png`, from `NARROW_FIXTURE_IDS`).
A capture waits for the builder to mount and for its preview player to finish
painting (no node skeletons left).

The captures show the island on the fixture app's page, without the site's
header, fonts and page padding. Those are covered by the site's e2e specs.
`pnpm visual -g builder` selects all twelve.

## Where examples come from

The registry (`@texuli/examples`, through the fixture app's
`src/examples.ts`): the spec calls `listExamples()` when it loads, so a newly
registered example gets its own tests (one per color scheme) with no change
here. Its loaders stay lazy, so the spec never imports Svelte. The fixture app
renders an example at `/?fixture=<id>` inside `[data-example-host="<id>"]`. A
capture waits until the host no longer shows its "Loading example…" status and
has no load-error alert. The app's own `smoke` page is captured too, as a
canary. A new example has no baseline yet: run `pnpm visual:update`, review
its PNGs and commit them with the example.
