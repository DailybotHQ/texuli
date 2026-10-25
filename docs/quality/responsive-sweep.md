# Responsive and right-to-left sweep: PLAN_004 surfaces

**Gate:** `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/responsive-sweep.spec.ts`
(after `pnpm build`)  
**Fixture page:** `tests/fixtures/app/responsive.html`

Swept 2026-10-25 on dev `7401c16c` (task 188).

## What is checked

| Surface | Where it is mounted | Checks |
| --- | --- | --- |
| Player G20 layouts (stack, row, split, grid, tile) | Fixture page | Widths and direction; in RTL a layout row's first card sits to the right of the second once they share a line |
| Player controls (toggle, choice, slider, filter) | Fixture page | Widths and direction |
| Player action form (fields and submit) | Fixture page | Widths and direction |
| Player flow (flow views and actions, guarded by a toggle) | Fixture page | Widths and direction |
| Media animation timeline (`AnimationTimeline`, lazy editor) | Fixture page, the golden lower-third composition | Widths and direction |
| `/agent-chat/` | Built site | Widths and direction (`dir="rtl"` set after load) |
| `/builder/` (outline, inspectors, palette, preview) | Built site | Widths and direction, plus the outline's RTL keyboard test in `tests/e2e/site-builder.spec.ts` |

At **360, 400, 768, 1024 and 1440 px**, in **LTR and RTL**, every case asserts:

- no horizontal page scroll (`scrollWidth <= clientWidth`);
- no visible element extends past the viewport's inline edges, unless an
  ancestor clips or scrolls it (its own scroll container).

The source scan covered `packages/player/src` (frames, layouts, controls,
flows, regions, action forms), `packages/media/src/timeline`, and the
website's builder and agent-chat components and pages: no physical
`left`/`right` margins, paddings, borders, offsets, `text-align` or `float`,
no `translateX`, and no fixed inline sizes of 100 px or more.

## Findings and fixes

| Finding | Fix |
| --- | --- |
| The animation timeline was 568 px wide at 360 and 400 px: its table (two columns with a 12rem minimum plus a non-wrapping layer column) widened the whole editor grid, toolbar and stage included | The editor grid is a single `minmax(0, 1fr)` column, and the table sits in a focusable, labelled region (`role="region"`, `tabindex="0"`) that scrolls horizontally on narrow screens. Wide screens are unchanged. |
| The builder outline used ArrowRight to expand, enter and indent, and ArrowLeft to go to the parent and outdent, in RTL too | In a right-to-left page the horizontal arrows swap, as the WAI-ARIA tree pattern specifies (`logicalKey` in `Outline.svelte`). The new site-builder test fails on the old outline and passes now. |

Already correct and left as is: the player's frame keyboard (`keyboard.ts`)
and `control-choice` swap arrows in RTL; the timeline places windows and
keyframes with `inset-inline-start`, and its keyboard and drag reverse in
RTL.

## Results (2026-10-25)

- `responsive-sweep.spec.ts`: Chromium 30/30 and Pixel 7 30/30 passed. Before
  the timeline fix, the fixture cases at 360 and 400 px failed in both
  directions.
- `site-builder.spec.ts`: Chromium 12/12, including the new RTL outline test.
- `pnpm visual -g "media-|player-"`: no changes (84 capture sets).

## Not covered, or planned

- **WebKit is not run on this host:** its build does not start on macOS 27
  (a known environment gap; see the task 181 diagnosis). Firefox is not in
  the matrix.
- Host regions (`HostRegion`) need a host shell, so they are not on the
  fixture page; they keep their unit tests (`packages/player/tests/host-regions.test.ts`).
- Layout behavior at the declared widths is checked for overflow and
  direction, not against visual baselines: the fixture page has no
  baselines. **Planned:** registry examples for the player's controls, flows
  and action forms and for the timeline editor, so the visual suite covers them.
