# Screen-reader transcripts (VoiceOver, macOS)

**Task:** `T-quality-sr-transcripts` (PLAN_001)  
**Primitives:** Dialog, Combobox, Select, Menu, DatePicker, Toast  
**Fixtures:** behavior scenarios at `tests/behavior/scenarios/<primitive>/scenario.svelte`  
**Date:** 2026-10-23

## Method

These transcripts are **hand-authored VoiceOver (macOS) phrasing** for the
behavior scenarios. They were grounded on:

1. The live accessibility tree from Playwright `ariaSnapshot()` on Chromium
   (`TEXULI_E2E_PORT=4930`, `?behavior=<name>`) on 2026-10-23.
2. The WAI-ARIA Authoring Practices patterns each primitive implements.
3. macOS VoiceOver conventions for roles, names, and state changes
   (expanded/collapsed, selected, checked, dialog).

They are **not** a machine dump of VoiceOver speech. Spoken prosody and
rotor labels can differ slightly by VO verbosity and macOS version. A live
VoiceOver pass on Safari or Chrome remains part of the release gate when
those primitives change.

Re-capture the tree (lane port, never 4870):

```sh
pnpm --dir tests/fixtures/app exec vite --host 127.0.0.1 --port 4930 --strictPort
# then open a scenario, http://127.0.0.1:4930/?behavior=dialog, and read its tree
# with Playwright's locator.ariaSnapshot() or the browser's accessibility panel
```

The capture script used on 2026-10-23 was a local helper and is not in the
repository; the transcripts are written by hand from the tree.

Behavior (focus, Escape, inert, events) is already asserted by
`TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/<primitive>.spec.ts`.

## Shared harness chrome

Every behavior scenario page also exposes:

| Control | Typical VoiceOver |
| --- | --- |
| Before | “Before, button” |
| After | “After, button” |
| Outside area | static text (inert while a modal dialog is open) |

Transcripts below omit that chrome unless it matters for the flow.

---

## 1. Dialog (`@texuli/primitives/dialog`)

**Fixture:** Open settings → Settings dialog (nested Details optional).

### Tree (open)

- Button “Open settings” **expanded**
- Dialog “Settings” (modal)
  - Heading “Settings”
  - Description: “Change how your fictional workspace looks.”
  - Text field “Display name” value Ada Example
  - Button “Open details”
  - Button “Close”

### VoiceOver transcript

1. Tab to the trigger: **“Open settings, button.”**
2. VO+Space: **“Settings, dialog.”** Focus lands inside the dialog (first
   focusable control). VoiceOver also exposes the title and description via
   `aria-labelledby` / `aria-describedby`.
3. Trigger state after open: **“Open settings, button, expanded.”**
4. Tab cycles Display name → Open details → Close → back inside the dialog
   (focus trap). Outside chrome is not in the tab order while modal.
5. Escape: dialog dismisses; focus returns to **“Open settings, button”**
   (collapsed).

### Nested dialog

1. Activate **“Open details, button.”**
2. **“Details, dialog.”** with description “Workspace id: orbit-001.”
3. Escape closes the top dialog only; Settings remains open.
4. Escape again returns to the trigger.

### Findings

None blocking. Modal naming, expand state, trap, and restore match APG
Dialog. Automated Chromium `ariaSnapshot` may still list outside text nodes;
inertness is covered by the behavior suite, not by the snapshot alone.

---

## 2. Combobox (`@texuli/primitives/combobox`)

**Fixture:** Assignee field, people list, “Show people” disclosure.

### Tree (closed)

- Combobox “Assignee”
- Button “Show people”

### Tree (open, query “Ada”)

- Combobox “Assignee” **expanded**, value “Ada”
- Button “Show people” **expanded**
- Listbox
  - Option “Ada Example”

### VoiceOver transcript

1. Focus the field: **“Assignee, combobox.”** (editable, collapsed).
2. Type “Ada” or press Arrow Down / activate Show people: **“expanded”**;
   listbox appears. With an active option, VO reports the option via
   `aria-activedescendant` as focus stays on the combobox.
3. Arrow to **“Ada Example, option”** (or single match).
4. Enter: value commits; list closes (**collapsed**).
5. Escape while open: closes without committing a new selection when no
   confirm key was pressed.

### Findings

None blocking. Combobox + listbox + expanded/collapsed match APG Combobox
(list autocomplete).

---

## 3. Select (`@texuli/primitives/select`)

**Fixture:** Plan select (groups Personal / Organization).

### Tree (closed)

- Combobox “Plan”, value “Free” (select-only combobox pattern)

### Tree (open)

- Combobox “Plan” **expanded**, value “Free”
- Listbox
  - Group “Personal”
    - Option “Free” **selected**
  - Group “Organization”
    - Option “Team”
    - Option “Business” **disabled**
    - Option “Enterprise”

### VoiceOver transcript

1. Focus: **“Plan, combobox, Free.”**
2. Space / Enter / Arrow Down: **“expanded”**; listbox opens.
3. Arrow through options: **“Free, option, selected”**, **“Team, option”**,
   **“Business, option, dimmed”** (disabled), **“Enterprise, option.”**
   Group labels “Personal” / “Organization” are announced when entering a
   group.
4. Enter on Team: list closes; trigger **“Plan, combobox, Team”**
   (collapsed).
5. Escape: closes without changing the value when no selection was confirmed.

### Findings

None blocking. The trigger uses `role="combobox"` with `aria-haspopup="listbox"`
(APG select-only combobox). That is intentional, not a Dialog-style button
menu.

---

## 4. Menu (`@texuli/primitives/menu`)

**Fixture:** View menu with submenu, checkbox item, density radios.

### Tree (open)

- Button “View” **expanded**
- Menu “View”
  - Menuitem “New file”
  - Menuitem “Export”
  - Menuitemcheckbox “Show grid”
  - Separator
  - Group “Density”
    - Menuitemradio “Compact”
    - Menuitemradio “Comfortable” **checked**
    - Menuitemradio “Spacious”

### Tree (Export submenu)

- Menuitem “Export” **expanded**
- Menu “Export”
  - Menuitem “PNG” / “SVG” / “WebM”

### VoiceOver transcript

1. Focus trigger: **“View, button.”**
2. Space / Enter / Arrow Down: **“View, menu.”** First item takes focus
   (or is the active descendant, depending on VO mode).
3. Arrow Down: **“New file, menu item”** → **“Export, menu item”** →
   **“Show grid, menu item checkbox, unchecked”** → Density radios
   (**“Comfortable, menu item radio, selected”**).
4. On Export, Arrow Right: **“Export, menu”** with PNG / SVG / WebM.
5. Arrow Left or Escape: closes the submenu only; parent menu stays open.
6. Escape again: closes the root menu; focus returns to **“View, button”**
   (collapsed).

### Findings

None blocking. Submenu `aria-expanded`, checkbox/radio menuitems, and
separator match APG Menu.

---

## 5. DatePicker (`@texuli/primitives/date-picker`)

**Fixture:** Due date field + trigger; Stay range fields + trigger.

### Tree (closed, due date set)

- Group “Due date”
  - Spinbutton “Month” = 3
  - Spinbutton “Day” = 15
  - Spinbutton “Year” = 2026
- Button “Choose due date”

### Tree (calendar open)

- Button “Choose due date” **expanded**
- Dialog “Due date calendar”
  - Button “Previous month”
  - Heading “March 2026”
  - Button “Next month”
  - Grid “March 2026” with weekday columnheaders and day buttons
    named e.g. **“Sunday, March 15, 2026”**, gridcell **selected** for the
    current value

### VoiceOver transcript

1. Field group: **“Due date, group”** then Month / Day / Year spinbuttons.
2. Trigger: **“Choose due date, button.”**
3. Activate: **“Due date calendar, dialog.”** Focus moves into the calendar
   (selected day or first enabled day).
4. Arrow keys move by day; **“Sunday, March 15, 2026, button, selected”**
   when on the value.
5. Previous / Next month: heading updates (**“April 2026”**).
6. Enter on a day commits and closes; Escape cancels and restores focus to
   the trigger.

### Range picker

- Group “Stay” with nested “Start date” and “End date” spinbutton groups.
- Trigger **“Choose stay dates”** opens dialog **“Stay calendar”**
  (`aria-multiselectable` grid for the range).

### Findings

None blocking. Dialog naming uses the `labels.dialog` string from the
fixture (“Due date calendar” / “Stay calendar”). Day buttons carry full
date names suitable for VO.

---

## 6. Toast (`@texuli/primitives/toast`)

**Fixture:** Publish toast → Notifications region + live announcement.

### Tree (after publish)

- Region “Notifications”
  - List
    - Listitem: “File saved” / “Undo is available.”
      - Button “Undo”
      - Button “Dismiss notification”
- Status (polite live region): **“File saved. Undo is available.”**

### VoiceOver transcript

1. Activate **“Publish toast, button.”**
2. Immediate polite announcement: **“File saved. Undo is available.”**
   (via `@texuli/core/announcer` into an `aria-live="polite"` status region).
3. Rotor / interact with Notifications: **“Notifications, region”**, then
   the toast listitem with **Undo** and **Dismiss notification**.
4. Dismiss removes the item; no further announcement required for a user-initiated close.

### Findings

None blocking. Background-tone toasts use polite live regions; the visible
toast remains in a named landmark for review.

---

## Defect log

| ID | Primitive | Issue | Resolution |
| --- | --- | --- | --- |
| — | — | No blocking SR defects found in the behavior scenarios on 2026-10-23 | — |

Non-blocking notes:

- Chromium `ariaSnapshot` can still list “Outside area” while a modal dialog
  is open; the behavior suite asserts inert/scroll-lock separately.
- Select’s trigger role is **combobox** (select-only), not `button`; document
  that in consumer guidance so authors do not expect a pure Button+Listbox
  naming pattern.

## Related gates

| Check | Command |
| --- | --- |
| Transcript file present | `test -f docs/quality/sr-transcripts.md` |
| VoiceOver mentioned in hub | `grep -q VoiceOver docs/ACCESSIBILITY.md` |
| Behavior (per primitive) | `TEXULI_E2E_PORT=<lane-port> pnpm exec playwright test tests/behavior/scenarios/<primitive>.spec.ts --project=chromium` |
