# Accessibility sweep: display, data and media

**Task:** `T-quality-a11y-display` · **Gate:** `tests/e2e/a11y-display.spec.ts`  
**Follow-up:** `FIX-a11y-deferred` (zero axe exclusions; deferred fixtures restored)

Automated axe-core checks for display chrome, data views, charts and media
examples. Findings are fixed at the component source; the gate never disables
axe rules.

## Scope (under gate)

| Family | Example ids |
| --- | --- |
| Display | `texuli-badge`, `texuli-card`, `texuli-stat`, `texuli-table`, `texuli-empty`, `texuli-stepper`, `texuli-timeline`, `ui-avatar`, `ui-carousel` |
| Data | `data-grid-core`, `data-timeline`, `data-board`, `data-calendar`, `data-files`, `data-virtual-list`, `data-map`, `data-tree-view` |
| Charts | `charts-interaction`, `charts-cartesian`, `charts-compact`, `charts-part-whole`, `charts-matrix` |
| Media | `media-video`, `media-audio`, `media-gallery`, `media-image` |

## Current coverage boundary

This sweep does not yet cover newer registered media examples such as
`media-export`, `media-generator-slot`, or `media-image-editor` variants.
Targeted interaction-level coverage for these queue, generation and editor
flows in this sweep is **planned**; the current passing count applies only to
the examples listed in the gate scope. Page-level checks of built-site routes
are reported separately in `a11y-site.md`; CSP and SSR coverage do not imply
an accessibility check.

## What the gate checks

1. **Light and dark axe** — every fixture above. Zero violations, zero rule exclusions.
2. **Forced colors** — badge, table, timeline, all deferred data fixtures, grid, charts-interaction, gallery.
3. **400% reflow** — card, stat, compact charts, audio at 320 CSS-px width.
4. **Keyboard and roles** — grid arrows, chart explorer, video controls, gallery images, carousel.
5. **RTL** — avatar, table, data timeline, compact charts.
## Source fixes (including FIX-a11y-deferred)

| Area | Change |
| --- | --- |
| Charts matrix | SVG `role="img"` uses `aria-label` from title+description |
| Board | `div role=listitem`; empty cells are listitems; unique board landmark labels; CanvasText colors |
| Timeline (data) | Critical bars AA fill + white labels |
| Timeline (texuli) | Muted/link use `currentColor`; dark demo panel sets token overrides |
| Tree view | Selected row AA outline + CanvasText; forced-colors Highlight/HighlightText; unique labels |
| File browser | No nested buttons in options; Space selects; unique landmarks; AA detail/layout colors |
| Calendar | Day headings include visible weekday/day in `aria-label` |
| Map | Attribution/header use foreground on background; AA demo chrome |
| Virtual list | Demo secondary text uses CanvasText |
| Card demo | `linkLabel` includes visible title and description |
| Captions / video | Chapter/time text CanvasText; current chapter AA surface |

## Run

```sh
TEXULI_E2E_PORT=<lane-port> pnpm exec playwright test tests/e2e/a11y-display.spec.ts
```

## Honesty limits

- axe does not prove screen-reader speech.
- APCA is out of scope; WCAG 2.x contrast is the contrast gate.
- Forced-colors still needs a visual pass beyond axe for some chrome.

## Findings log

| Date | Result | Notes |
| --- | --- | --- |
| 2026-10-23 | 111 passed | Initial sweep; several data fixtures deferred |
| 2026-10-23 | **156 passed** | FIX-a11y-deferred: all seven restored under light/dark/forced-colors |
| 2026-10-25 | **106/106 passed** (chromium, mobile) | Fresh run on dev `852b8d2a`; all current display, data, charts and media checks passed. WebKit not run in the current machine-load window. |
