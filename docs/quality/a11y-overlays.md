# Overlay and navigation accessibility sweep

This sweep records the browser accessibility checks for Texuli overlays and navigation examples. It exercises Axe in light and dark modes, overlay dismissal and focus restoration, a mobile navigation drawer, forced colors, and right-to-left rendering.

## Run and latest result

```sh
TEXULI_E2E_PORT=<lane-port> pnpm exec playwright test tests/e2e/a11y-overlays.spec.ts
```

On 2026-10-25, 32/32 tests passed on Chromium and Pixel 7 (`mobile`) against
dev `852b8d2a` (port 4961). WebKit was not included in this run.

## Coverage

The Playwright spec `tests/e2e/a11y-overlays.spec.ts` checks dialog, dialog states, sheet, menus, popover, tooltip, command palette, sidebar, and navigation examples. The Axe scan includes each example root and open dialog, menu, and tooltip layers rendered outside that root. Tests run in the repository's Chromium, WebKit, and mobile Chromium projects on the lane's private port.

## Source findings fixed

- Tooltip shortcut keys now inherit the tooltip's foreground and use a transparent fill so their text retains the tooltip's tested contrast.
- Command group headings remain visible but are hidden from the listbox accessibility tree; the named group supplies the accessible name while the listbox contains its required option roles.
- Breadcrumb separators are decorative content inside breadcrumb list items rather than additional list children with `role="presentation"`.
- Sidebar labels use a contrast-adjusted foreground in both color schemes, active tint is reduced, and the example gives each navigation landmark a distinct accessible name.
- AppNav can render its content container as a non-landmark with `mainLandmark={false}` when the shell is embedded inside an existing main landmark. It keeps the main landmark by default.
- Dialog descriptions retain readable text in forced-colors mode by using the system text color rather than `GrayText` on a system canvas.

## Limits

Automated Axe checks do not replace keyboard and screen-reader testing with assistive technology. The checks use the fixture examples and do not claim conformance for arbitrary consumer overrides or all browser/AT combinations.
