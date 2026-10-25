# Accessibility sweep: slides

**Task:** `T-p7-deck-a11y` (PLAN_004) · **Gate:** `tests/e2e/a11y-slides.spec.ts`  
**Unit tests:** `packages/slides/tests/a11y.test.ts`  
**Transcripts:** [sr-transcripts-slides.md](sr-transcripts-slides.md)

axe-core and keyboard checks for `DeckStage` and `DeckPrint`, using the four
slides examples as fixtures. Findings were fixed at the source; the gate
disables no axe rules.

## Scope

| Fixture | Surface |
| --- | --- |
| `slides-template-report` | `DeckStage` on a media-left slide (figure + text) |
| `slides-template-pitch` | `DeckStage` on a media-right slide (list + image), notes on slide 2 |
| `slides-template-review` | `DeckStage` on a media-left slide with a code block |
| `slides-media-deck` | `DeckPrint`: three pages, figure, image and gallery |

## What the gate checks

1. **axe, zero violations:** every fixture on a light page, on a dark page
   while the OS prefers light, and on a dark page on a dark OS.
2. **axe in interactive states:** each template with the overview open and
   with the presenter view open, in light and dark.
3. **Forced colors:** the report stage and the print view.
4. **Reflow:** every fixture at 320 CSS px with no horizontal scroll.
5. **Names and structure:**
   - the region “Presentation: <title>” and the group “Presentation controls”;
   - “Previous slide” and “Next slide”;
   - the polite position text;
   - the outline: page h1, slide title h2, presenter pane h2s, one h2 and
     one region per print page;
   - the complementary “Speaker notes”, the region “Up next” and the timer
     “Elapsed time”.
6. **Keyboard:**
   - Right/Left, Page Up, Space, Home and End change slides and move focus
     to the new slide, without wrapping when the deck doesn't loop;
   - `o` focuses the current overview item, and Escape returns focus to
     Overview;
   - `p`, `s` and Escape for the presenter view;
   - tab order: controls, then slide content, then presenter panes;
   - single-key shortcuts act only while focus is inside the deck.
7. **Reduced motion:** with `prefers-reduced-motion: reduce`, an entering
   slide has `data-transition="none"`. Without it, the slide gets the deck's
   token (`fade`).

## Source fixes

| Area | Finding | Change |
| --- | --- | --- |
| Color mode | A `system`-mode deck on a dark host page with a light OS painted light theme tokens while nested blocks kept dark-mode colors: axe `color-contrast` failures of 1.74 to 2.4 | `system` follows the nearest host `data-tx-mode` (light, dark or high-contrast) before the OS preference (`resolveDeckThemeMode(ref, matchMedia, hostMode)`). Root changes are observed |
| Controls | `aria-label="Presentation controls"` sat on a `div` with no role, so it was never exposed | `role="group"` (not `toolbar`: the buttons are separate Tab stops, with no arrow-key roving) |
| Presenter toggle | `p` re-mounted the slide in the new layout and dropped focus to `body`, so the next arrow key was ignored | Toggling from inside the slide returns focus to the re-mounted slide |
| Re-mount motion | Opening the presenter view or closing the overview replayed the slide's fade on the same slide, and axe measured text mid-fade | Only navigation to another slide animates; layout changes render with `data-transition="none"` |
| Loading chatter | Every revisit flashed a `role="status"` “Loading slide content…” for blocks whose family had already loaded | Loaded families are cached and render on the first render (`loadedDeckBlockFamily`) |
| Example data | Gallery alt text repeated its visible caption (`image-redundant-alt`) | The examples describe each image and keep the short caption |
| Example readiness | Opening the overview brought the demo's “Loading example…” status back | Demo readiness latches once reached |

## Run

```sh
TEXULI_E2E_PORT=<lane-port> pnpm exec playwright test tests/e2e/a11y-slides.spec.ts --project chromium --project mobile
pnpm vitest run packages/slides/tests/a11y.test.ts
```

On 2026-10-25, a fresh run on dev `852b8d2a` (port 4961) passed 44/44 on `chromium` and
`mobile` (Pixel 7); `pnpm vitest run packages/slides/tests/a11y.test.ts`
passed 6/6; and `pnpm visual -g slides-` passed 16/16 with no changes. The
`webkit` project was not run: headless WebKit could
not launch on the machine (`browserType.launch` timed out after 180 s), and
the existing `a11y-display` spec fails the same way there. `pnpm visual -g
slides-` reported no changes after the fixes.

## Not covered

- A live screen-reader session; see the transcript method.
- Firefox and WebKit automation (see above).
- Reveal steps: validated block data that the stage does not play yet.
