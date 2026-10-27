# Accessibility sweep: texuli.com

**Task:** T-quality-a11y-site · **Spec:** `tests/e2e/a11y-site-<n>.spec.ts`

One page of each route group of the built website runs axe with **zero
exclusions** in light, dark and high contrast, the visual polish check
([site-visual](../../apps/website/docs/site-visual.md)) on the light and
dark loads, and a keyboard-only walk. The pages are dealt round robin into
five tests, each walking its pages in one page session. Findings were fixed
**at their source**; no rule is disabled, no selector excluded, no gate
weakened.

```bash
bash -c 'pnpm build && TEXULI_E2E_PORT=<lane port> pnpm exec playwright test tests/e2e/a11y-site-1.spec.ts tests/e2e/a11y-site-2.spec.ts tests/e2e/a11y-site-3.spec.ts'
```

## What the sweep checks

- **Pages:** the first page of each route group of the built
  `dist/sitemap.xml`, plus the 404 (an unknown path). The pages of a group
  share a template; the components of the large groups (`/examples/…` and
  `/component-pages/…`, about 300 pages) are also axe-checked in light and
  dark by the fixture-app sweeps (`a11y-*.spec.ts`). `sweepSample` in
  `tests/e2e/support/site.ts` picks them from the build, so new groups join
  with no change to the spec (2026-10-27: 358 pages swept became 51, then
  31 in 5 tests).
- **Server:** `dist/` served like a static host (unknown paths get
  `404.html` with status 404).
- **axe, zero exclusions:** tags `wcag2a`, `wcag2aa`, `wcag21a`,
  `wcag21aa`, `wcag22a`, `wcag22aa` and `best-practice`. No `disableRules`,
  no `exclude`.
- **Modes:**
  - **light:** `prefers-color-scheme: light`; `data-tx-mode="light"` is
    asserted;
  - **dark:** `prefers-color-scheme: dark`; `data-tx-mode="dark"` is
    asserted;
  - **high contrast:** `forced-colors: active`, which is how Windows high
    contrast and similar modes reach the page;
  - reduced motion is on in every mode.
- **Keyboard only:**
  - the first Tab stop is "Skip to content";
  - every following stop (up to 40, or until focus cycles back) is visible
    (non-empty box, not `visibility: hidden`) and shows a focus indicator
    (an outline or box-shadow on the element, or a ring drawn by a wrapper
    within 3 levels, for `:has(:focus-visible)` patterns);
  - focus never drops to `body` mid-walk;
  - Shift+Tab walks back out (no trap).
- **Component pages** also mount their live stage (the real component, its
  marker part on screen, no request to another origin), the check
  `site-live-components.spec.ts` used to run on separate loads.
- **Primitive pages** (`/primitives-page/<id>/`) are swept by
  `site-live-primitives.spec.ts`, with the demo mounted, the API rows and
  the demo's floating content open, in light, dark and forced colors (the
  representative primitives); here only the group's representative runs.
- **Projects:** the e2e suite runs on Chromium (locally and in CI). Run on
  WebKit, the keyboard walk is skipped because its default Tab order skips
  links and buttons (a macOS setting).

## Findings and fixes (at the source)

The first Chromium run: 689 passed, 35 failed. Every failure was a real
defect.

| Finding | Where | Root cause | Fix |
| --- | --- | --- | --- |
| `page-has-heading-one` (8 pages × 3 modes) | `/charts-page/<family>/` | The family page's title was the frame's `<h2>`; the page had no `<h1>` | `ChartFamilyFrame` takes `headingLevel` (1 on the family page, 2 in the gallery); its section headings follow one level below (`h2`/`h3`), so the outline does not skip (`heading-order` was caught and fixed too) |
| `landmark-unique` | `/evidence/` | Every evidence panel was a `<section>` named "Evidence" | The heading carries a visually hidden " for &lt;id&gt;", so each landmark is "Evidence for button" while the visible text stays "Evidence" |
| `landmark-unique` | `/media-page/` | Two `AudioPlayer`s were both named "Audio player": the page passed `title=`, which is not an `AudioPlayer` prop, so the default label applied | `MediaLab` passes `label="Harbor tone (synthetic)"` and `label="Blocked audio"` |
| `aria-allowed-role` (24 cards) | `/gallery-themes/` | `<article role="listitem">` inside `<div role="list">` | A native `<ul>` of `<li>` items, each holding the `<article>` (the empty state is an `<li>` too); the list styles were reset |
| `color-contrast` 1.07:1 (high contrast) | `/showcase/dashboard/` → texuli `Stat` | In forced colors the trend delta used `Mark` (a highlight *background*, yellow on Canvas) and `LinkText` (reads as a link) | `stat.css`: good, bad and neutral deltas use `CanvasText`; the arrow icon and the signed value carry the trend |
| No visible focus indicator (3 buttons) | `/showcase/inbox/` thread list | `:focus-visible` set `outline: none`, leaving a 6% background tint (WCAG 2.4.7) | Hover keeps the tint; `:focus-visible` gets the token ring (`--tx-ring`, inset 2 px) |

Historical full-matrix result after the fixes, on 2026-10-23:

| Project | Result |
| --- | --- |
| Chromium | **724 / 724 passed**: 181 pages × (axe in light, dark and high contrast + the keyboard walk) |
| Pixel 7 | **84 / 84 passed**: 21 representative pages × 4 |
| WebKit | **63 passed**: 21 representative pages × axe in 3 modes (the keyboard walk is skipped by design). An earlier run hit `browserType.launch` timeouts under a load average near 200; the final validation run passed in one go |

The site specs for every page touched by the fixes (charts-page,
component-pages, evidence, gallery-themes, media-page, showcase) still
pass: 33 / 33 on Chromium.

## Current build sweep (2026-10-25, dev `852b8d2a`)

After the current `pnpm build`, the sitemap contained 383 URLs. The Chromium
run on port 4962 covered those routes plus the 404 (1,536 checks total):
**1,530 passed; 6 failed**. No rule was excluded. The failures remain two
routes × three color modes:

| Route | Axe findings | Severity |
| --- | --- | --- |
| `/builder/` (light, dark, high contrast) | `landmark-main-is-top-level` on `#s0-s3-frame-0`, `landmark-no-duplicate-main` and `landmark-unique` on `#main` | Moderate |
| `/component-pages/charts-canvas-renderer/` (light, dark, high contrast) | `scrollable-region-focusable` on `.frame__stage` | Serious |

These were current source findings, not flaky retries. Both routes were
remediated the same day:

- The builder page embedded the player inline inside the page's `main`, so
  the player's page layout painted a second `main`. The player now takes
  `landmarks={false}` and paints a plain section instead (bf0051c0).
- `DemoFrame` stages scroll wide demos horizontally; they are now labelled
  focusable regions with a focus-visible ring (abde0e58).

Re-verified after the fixes: the two routes plus the 404 pass in all three
color modes, and a full re-run of the sweep on the rebuilt site (2026-10-25,
dev `c89821b5`, Chromium, port 4977, no rule excluded) is
**1,536 passed; 0 failed**. WebKit and Pixel 7 were still not run in this
full-route sweep; the prior multi-project results above remain historical
only.

## Limits

- **Automated checks only.** axe and the focus walk do not replace
  screen-reader testing (VoiceOver, NVDA) or a manual check at 400% zoom.
- **High contrast is emulated** with `forced-colors: active` in Chromium,
  not with a real Windows high-contrast theme.
- **The focus check is a heuristic:** it requires a visible outline or
  box-shadow (or a ring on a close wrapper). It does not measure the ring's
  contrast (WCAG 2.4.13, AAA).
- **WebKit's keyboard walk** is not run (platform Tab setting). WebKit
  still runs axe in all three modes on the representative pages.
