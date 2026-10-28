# Accessibility

Texuli primitives keep keyboard interaction and focus behavior in owned,
framework-free texels. The overlay engine is opt-in by feature: a primitive
composes positioning, focus scope, inertness, scroll locking and portal
behavior only where its interaction requires them. Dialog is modal, traps
focus while open, makes the outside page inert, locks scrolling and restores
focus on close. Tooltip, Menu, Select and Combobox use positioning without
importing Dialog's focus, inert or scroll-lock texels. Popover also composes
those modal features because it supports a modal mode.

## Screen readers (VoiceOver)

Hand-authored **VoiceOver (macOS)** transcripts for Dialog, Combobox, Select,
Menu, DatePicker and Toast live in
[quality/sr-transcripts.md](quality/sr-transcripts.md). They are grounded on
the behavior scenarios and live accessibility trees, and record expected
spoken names, roles and state changes. No blocking screen-reader defects were
logged for those fixtures on 2026-10-23.

```sh
# Confirm the hub and transcript pack are present
grep -q VoiceOver docs/ACCESSIBILITY.md
test -f docs/quality/sr-transcripts.md
```

Automated browser checks do not establish that announcements are spoken by
assistive technology. Re-run a live VoiceOver pass on Safari or Chrome before
a release that changes those primitives.

The website's page classes (landing, native landing, architecture page, a
guide and the studios) had an **accessibility-tree pass** on 2026-10-26, not a
screen-reader session: [quality/sr-transcripts-site.md](quality/sr-transcripts-site.md)
reads Playwright `ariaSnapshot()` trees of the built site and lists the three
page-layer fixes it made. It also recorded four studio findings (theme-studio
label in name; the playground's false preview status, long preset names and
replaced Validation status), which T-88 fixed and pins in
`apps/website/tests/studios.test.ts` and
`apps/website/tests/playground-sr.test.ts`. No screen reader was run for it.

## Focus performance

The Dialog behavior scenario measures from the trigger activation to the first
focus event inside the opened dialog. The seven-sample Chromium p75 measured
on 2026-10-23 was **1.8 ms**, under the 50 ms target. This is a browser
automation measurement, not a screen-reader or cross-browser performance
result.

```sh
TEXULI_E2E_PORT=<lane-port> pnpm exec playwright test tests/behavior/scenarios/dialog.spec.ts --project=chromium
```

The behavior suite also checks that focus moves into the dialog, Tab and
Shift+Tab remain inside it, Escape returns focus, and nested dialogs close in
top-layer order.

## Contrast

WCAG 2.x contrast (AA) in light, dark and `forced-colors` is the repository
contrast gate. APCA is out of scope (license).

Under `forced-colors`, axe measures an element's author text color against
the forced `Canvas`. Any surface painted from its own theme variables (a
theme preview card, a filled call to action) therefore names system colors
(`Canvas`, `CanvasText`, `LinkText`) inside `@media (forced-colors: active)`.
Otherwise a dark theme's light text is measured on a white Canvas.

## Site sweep

`tests/e2e/a11y-site-<n>.spec.ts` runs axe with zero exclusions in light, dark
and forced colors, the polish check and a keyboard-only walk on one page of
each route group of the built sitemap, plus the 404 (the pages of a group
share a template; the components of the large `/examples/…` and
`/component-pages/…` groups are also checked in light and dark by the
fixture-app sweeps `a11y-*.spec.ts`, which axe every listed example in
light and dark in a few tests, one page session each).
Findings in package code are fixed in the component, never excluded or
overridden at page level.

```sh
pnpm build
TEXULI_E2E_PORT=<lane-port> pnpm exec playwright test tests/e2e/a11y-site-1.spec.ts tests/e2e/a11y-site-2.spec.ts tests/e2e/a11y-site-3.spec.ts --project=chromium
```

## Keyboard

`tests/e2e/site-keyboard.spec.ts` walks one page per page class (landing,
native, architecture, a guide, a component page, a studio, the theme
gallery, the 404) with Tab until focus wraps to the first stop or falls to
`body`: the skip link lands in `main` and the walk ends without a trap. It
then checks that Shift+Tab lands on the last stop and retraces the last 8
stops before it (fewer on a page with fewer stops), not the whole walk.
Because focus falling to `body` also ends the walk, a control that drops
focus mid-page would end it early. Desktop Chromium only.

The website's tool islands (theme studio, color explorer, playground) have
single-key shortcuts. Per WCAG 2.1.4 they are **active only while the focus
is inside the tool** (`apps/website/src/components/tool-keys.ts`). They never
fire in a field or in a widget with typeahead (listbox, menu, tree, grid,
combobox), never with Control, Meta or Alt, and never for a key press
another handler already handled. A handled shortcut prevents the browser's
default action.

```sh
pnpm build
TEXULI_E2E_PORT=<lane-port> pnpm exec playwright test tests/e2e/site-keyboard.spec.ts --project=chromium
```

## Drag and workflows

Every drag surface (the `@texuli/primitives/sortable` binding, the
`@texuli/data` board, tree view, calendar, timeline and column moves,
`@texuli/workflows` and the player's `sortable-list`) follows one contract,
[`@texuli/drag`'s interaction, accessibility and i18n contract](../packages/drag/docs/contract.md).
`@texuli/drag` and `@texuli/workflows` are in development and on npm as
`0.3.0`; the sortable binding, the data migrations and the player's
`sortable-list` are in the repository and ship with the next release of
`@texuli/primitives`, `@texuli/data` and `@texuli/player`.

- **Keyboard first.** Space or Enter on a handle picks up, arrows move
  (inline arrows flip in right-to-left text), Space or Enter drops, Escape
  cancels and restores the origin with focus kept on the item, Tab cancels.
  Every pointer drag has a non-drag alternative (WCAG 2.5.7), such as the
  board's "Move to…" menu or the workflow palette's buttons.
- **Named handles.** Handles are buttons with a localized
  `aria-roledescription` and `aria-describedby` instructions; containers keep
  their pattern role; no deprecated `aria-grabbed` or `aria-dropeffect`;
  handles and ports meet the 24 by 24 CSS pixel target (WCAG 2.5.8).
- **Announced in any language.** Every pick-up, move, drop, cancel and
  refusal is announced politely from `DragMessages` templates that a locale
  overrides; pointer drags announce only target changes, debounced.
- **Motion and colors.** Reduced motion turns off move and drop animations;
  forced colors keep handles, drop indicators and focus visible.
- **Workflows.** On the canvas, arrows move focus to the nearest node in that
  direction, Alt+Arrow nudges a grid step, Space toggles selection, Enter on
  a port starts connect mode (arrows cycle compatible ports, Enter connects,
  Escape cancels), Delete removes, Ctrl or Cmd with Z and Y undo and redo,
  with = and - zoom, and 0 fits. The outline is a WAI-ARIA treegrid that
  reads the whole graph and edits it without the canvas (renaming is
  covered by the behavior suite). The read-only viewer is a figure whose nodes are a list that says
  where each one leads.

Checked by the behavior suite on Chromium and WebKit:
`tests/behavior/scenarios/sortable.spec.ts` (named and described handles,
keyboard reorder and cross-list moves, Escape restore, pointer and touch
drags, axe) and `tests/behavior/scenarios/workflow-editor.spec.ts` (spatial
focus, nudge and undo, keyboard connect, the treegrid outline rename, a
pointer drag, and axe in light and dark). No screen-reader session has been
run on these surfaces yet.

## Slides stage

The `@texuli/slides` `0.4.0` stage (in the repository, not on npm; the full
contract is [stage.md](../packages/slides/docs/stage.md)) follows this
contract:

- **Key map.** One registry (`DECK_CONTROLS` in `@texuli/deck/engine`)
  drives the keys, the toolbar, the tooltips and the help dialog, so they
  cannot disagree: arrows, Page Up and Down, Space, Shift+Space, Enter and
  Backspace step and move; Home and End jump; `O` overview, `F` full
  screen, `S` or `P` presenter, `B` or `.` blackout, `L` laser, `?` help.
  Keys act while focus is inside the deck (and, for the deck that owns the
  URL hash, while nothing on the page has focus). They never fire on
  buttons, links, fields, interactive blocks or the chrome, and the
  horizontal arrows swap in right-to-left decks. Esc closes the innermost
  layer first: help, overview, blackout, laser, then full screen. Every
  control is a button too, with a target of at least 32 px (44 px on touch).
- **Live region.** One polite, atomic live region announces “Slide n of m:
  <title>”, and “, step k of s” on a slide with steps, after every move.
  Chrome notices (copy link, the laser turning on or off) are polite too.
  Presenter timers are readable on demand and never announced every second.
- **Slides.** Each slide is a `group` with the role description “slide”,
  named by its title (or “Slide n”). At most three slides are mounted; the
  two that are not current are `inert` and hidden from assistive tech.
- **Focus after transitions.** After a keyboard move, focus goes to the
  incoming slide, never the outgoing one: with View Transitions, the stage
  focuses it inside the transition's DOM update. It only does so while focus
  was in the deck (or dropped to `<body>` by the swap), so an embedded deck
  never takes focus back from the page. Overview, full screen and blackout
  return focus to the slide when they close.
- **Help dialog.** `?` opens a modal dialog (`showModal`) generated from the
  registry, grouped like the toolbar, listing every key and “Button only”
  for controls without keys, filtered by what the page can do. Focus moves
  to Close and stays inside; Esc, `?` or Close shut it and return focus to
  its opener.
- **Presenter.** The presenter layout is a labelled region beside the slides
  (notes as a complementary region, up next, optional timers). The presenter
  window is a second same-origin window with its own polite live region; it
  focuses the notes on open and takes the same navigation keys. When the
  browser blocks the window, the presenter view stays on the page and a
  status note says why.
- **Motion, colors and reflow.** Reduced motion turns slide movement into a
  short fade (motion `none` cuts) and stops fragment animation; forced
  colors keep every control and layer bordered; every UI string comes from
  overridable messages, and `meta.locale` and `meta.dir` set `lang` and
  `dir`.

Checked by `tests/e2e/a11y-slides.spec.ts` on the built fixture app: axe with
zero violations on a light page, a dark page and a dark page on a dark OS;
axe with the overview, presenter, help and blackout open and in forced
colors; reflow at 320 CSS px; names and structure; and the keyboard map,
chrome, tab order, reveal steps, full screen and motion
([quality/a11y-slides.md](quality/a11y-slides.md)). Unit tests in
`packages/slides/tests/stage*.test.ts` cover the live region, focus after a
move and the help dialog. The VoiceOver transcripts in
[quality/sr-transcripts-slides.md](quality/sr-transcripts-slides.md) were
authored for the `0.3.0` stage (PLAN_004); no screen-reader session has been
run on the `0.4.0` stage yet.

## Related docs

| Doc | Role |
| --- | --- |
| [quality/sr-transcripts.md](quality/sr-transcripts.md) | VoiceOver transcripts for the six release primitives |
| [quality/sr-transcripts-site.md](quality/sr-transcripts-site.md) | Accessibility-tree readings of the website page classes (no screen reader run) |
| [quality/perf-primitives.md](quality/perf-primitives.md) | Measured primitive sizes and open-to-focus |
| [STANDARDS.md](STANDARDS.md) | Authoring rules (names, `aria-hidden`, keyboard) |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | axe, behavior, visual and SR gates |
