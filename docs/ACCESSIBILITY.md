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

## Related docs

| Doc | Role |
| --- | --- |
| [quality/sr-transcripts.md](quality/sr-transcripts.md) | VoiceOver transcripts for the six release primitives |
| [quality/sr-transcripts-site.md](quality/sr-transcripts-site.md) | Accessibility-tree readings of the website page classes (no screen reader run) |
| [quality/perf-primitives.md](quality/perf-primitives.md) | Measured primitive sizes and open-to-focus |
| [STANDARDS.md](STANDARDS.md) | Authoring rules (names, `aria-hidden`, keyboard) |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | axe, behavior, visual and SR gates |
