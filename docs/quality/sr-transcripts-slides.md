# Screen-reader transcripts: slides (VoiceOver, macOS)

**Task:** `T-p7-deck-a11y` (PLAN_004)  
**Components:** `DeckStage`, `DeckPrint` (`@texuli/slides/stage`)  
**Fixtures:** the slides examples `slides-template-report`,
`slides-template-pitch`, `slides-template-review` and `slides-media-deck`
(`packages/examples/src/slides/`)  
**Date:** 2026-10-25

## Method

The same method as [sr-transcripts.md](sr-transcripts.md): **hand-authored
VoiceOver (macOS) phrasing**, grounded on:

1. The live accessibility tree from Playwright `ariaSnapshot()` on Chromium
   (`TEXULI_E2E_PORT=4933`, `?fixture=<id>&mode=light`) on 2026-10-25, after
   the fixes listed in [a11y-slides.md](a11y-slides.md).
2. The deck keyboard contract in
   [packages/slides/docs/stage.md](../../packages/slides/docs/stage.md#routing-keys-and-pointer).
3. macOS VoiceOver conventions for regions, groups, articles, live regions,
   pressed toggle buttons, timers and complementary landmarks.

They are **not** a machine dump of VoiceOver speech. Prosody, verbosity and
rotor labels differ by VoiceOver settings and macOS version. A live
VoiceOver pass on Safari remains a release check. The capture helper was a
temporary local spec and is not in the repository. The behavior the
transcripts rely on (names, roles, focus, keys, reduced motion) is asserted
by `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/a11y-slides.spec.ts --project chromium`.

Re-capture the tree (lane port, never 4870):

```sh
pnpm --dir tests/fixtures/app exec vite --host 127.0.0.1 --port 4933 --strictPort
# then open http://127.0.0.1:4933/?fixture=slides-template-pitch and read the
# tree with Playwright's locator.ariaSnapshot() or the browser's accessibility panel
```

## Shared example chrome

Every example page starts with the link “All examples” and the example title
as the page's level-1 heading. The deck's own headings start at level 2.

---

## 1. Stage (`slides-template-pitch`, opened on slide 3)

### Tree

- Region “Presentation: Harborline”
  - Group “Presentation controls”
    - Button “Previous slide” (visible text “Previous”)
    - Text “Slide 3 of 6: The solution” (polite live region, atomic)
    - Button “Next slide” (visible text “Next”)
    - Button “Overview”
    - Button “Presenter” (toggle, not pressed)
  - Article “The solution”
    - Heading “The solution”, level 2
    - List, 3 items: Live container map · Generated manifests · Alerts before delays
    - Figure: image “Harborline live container map”

### VoiceOver transcript

1. VO+Right into the deck: **“Presentation: Harborline, region.”** Then
   **“Presentation controls, group.”**
2. Tab: **“Previous slide, button.”** Tab: **“Next slide, button.”** Tab:
   **“Overview, button.”** Tab: **“Presenter, toggle button.”**
3. Continuing with VO+Right: **“Slide 3 of 6: The solution.”** Then
   **“The solution, article,”** **“heading level 2, The solution,”** the
   list (**“list, 3 items”**), and **“Harborline live container map,
   image.”**
4. The slide itself is not a Tab stop (`tabindex="-1"`). Focus moves to it
   when the deck is navigated by keyboard from inside a slide (below).

## 2. Keyboard navigation (any template)

With focus on the slide article:

1. Right Arrow (or Page Down, Space, Enter): the next slide mounts and takes
   focus. The live region announces politely: **“Slide 4 of 6: Traction.”**
   VoiceOver then reads the focused **“Traction, article.”**
2. Left Arrow (or Page Up, Backspace): **“Slide 3 of 6: The solution.”**
3. Home: **“Slide 1 of 6: Harborline.”** End: **“Slide 6 of 6: The ask.”**
4. At the last slide, Right Arrow does nothing unless the deck loops. No
   announcement repeats.
5. A slide whose block families already loaded renders at once. No
   “Loading slide content…” status is announced on revisits (fixed in this
   task).

Single-key shortcuts (`o`, `p`, `s`) act only while focus is inside the deck
(WCAG 2.1.4, “active only on focus”). With focus on the page's own link,
they do nothing.

## 3. Overview (`o` from a slide, or the Overview button)

### Tree (open)

- Button “Close overview” **pressed**
- Navigation “Slides”
  - Buttons “1 Harborline”, “2 The problem”, “3 The solution”,
    “4 Traction” (current: `aria-current="step"`), “5 Customer voice”,
    “6 The ask”

### VoiceOver transcript

1. Press `o`: focus moves to the current slide's item: **“4 Traction,
   current step, button,”** inside **“Slides, navigation.”**
2. Tab or VO+Right walks the slide list in order.
3. Enter on **“2 The problem, button”**: the overview closes, the slide
   changes (**“Slide 2 of 6: The problem”**), and focus returns to
   **“Overview, button.”**
4. Escape instead closes without changing slides. Focus returns to
   **“Overview, button.”**

## 4. Presenter view (`p` from a slide, or the Presenter button)

### Tree (open, slide 3)

- Button “Presenter” **pressed**
- Article “The solution” (as in section 1)
- Timer “Elapsed time”: “0:00”
- Button “Pause timer”, button “Reset timer”
- Complementary “Speaker notes”
  - Heading “Speaker notes”, level 2
  - Paragraph (the notes, or “No notes for this slide.”)
- Region “Up next”
  - Heading “Up next”, level 2
  - Paragraph “Traction”

### VoiceOver transcript

1. Press `p` with focus in the slide: **“Presenter, toggle button,
   selected”** is the new state. Focus stays on the slide: **“The solution,
   article”** (fixed in this task; the slide re-mounts in the new layout).
2. Tab order after the controls: the slide's own controls (for example,
   **“Copy TS code, button”** on the review deck's code block), then
   **“Pause timer, button,”** **“Reset timer, button.”**
3. The timer is a `timer` role, which is not a live region, so the
   per-second ticks are not announced. VO+Right reads **“Elapsed time,
   timer, 0:12”** on demand.
4. Press `s`: focus moves to **“Speaker notes, complementary.”** VO+Right
   reads **“heading level 2, Speaker notes”** and the notes as plain text,
   line breaks kept.
5. VO+Right to **“Up next, region,”** **“heading level 2, Up next,”**
   **“Traction.”** Only the next slide's title is exposed (no thumbnail).
6. Escape: presenter view closes and focus returns to **“Presenter, toggle
   button.”**

## 5. Print view (`slides-media-deck`)

### Tree

- Document “Print: Harbor tour”
  - Region “Slide 1: The dock”: heading level 2 “The dock”; figure “East
    dock at shift change” with image “Cranes over the east dock”; paragraph
  - Region “Slide 2: The yard”: heading level 2 “The yard”; list of 2; image
    “Container yard from above”
  - Region “Slide 3: Around the port”: heading level 2; a list of three
    figures (“Pilot boat”, “Gantry”, “Rail spur”) whose images have their
    own alt text (“Pilot boat leaving the harbor mouth”, …)

### VoiceOver transcript

1. VO+Right: **“Print: Harbor tour, document.”** Then **“Slide 1: The
   dock, region,”** **“heading level 2, The dock.”**
2. The rotor's Headings list shows one level-2 heading per slide; the
   Landmarks list shows one region per slide.
3. Gallery images announce their description first, then the caption:
   **“Pilot boat leaving the harbor mouth, image,”** **“Pilot boat.”** (The
   example first repeated the caption as alt text; axe flagged it, and the
   example was fixed.)
4. Nothing in the print view is a Tab stop.

## Not covered

- A live VoiceOver, NVDA or JAWS session. These transcripts are authored
  from the tree.
- WebKit/Safari automation. The `webkit` Playwright project could not launch
  on the capture machine (`browserType.launch` timed out, for existing specs
  too), so the e2e gate ran on Chromium and the Pixel 7.
- Reveal steps (fragments): validated block data that `DeckStage` does not
  play yet, so there is nothing to announce.
