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

## Related docs

| Doc | Role |
| --- | --- |
| [quality/sr-transcripts.md](quality/sr-transcripts.md) | VoiceOver transcripts for the six release primitives |
| [quality/perf-primitives.md](quality/perf-primitives.md) | Measured primitive sizes and open-to-focus |
| [STANDARDS.md](STANDARDS.md) | Authoring rules (names, `aria-hidden`, keyboard) |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | axe, behavior, visual and SR gates |
