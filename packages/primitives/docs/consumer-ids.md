# Consumer ids (FIX-consumer-ids)

A consumer `id` on any part wins over the generated one, and every
reference to that part follows it. So `<label for="plan">` names
`<Select.Trigger id="plan">`, and a dialog Content's `aria-labelledby`
points at `<Dialog.Title id="…">`.

## How it works

- **Root:** holds a `$state` map of claimed ids. Each context getter
  (`triggerId`, `contentId`, `titleId`…) returns `claimed || generated`, so
  it is always the **effective** id.
- **Part:** renders the context's id and claims its consumer `id` with
  `context.claimId(part, id)`. It claims once at init (so server-rendered
  references agree), then in an `$effect` that follows changes and clears
  the claim on teardown.
- **Per-item parts** (tabs triggers and panels, accordion items, listbox,
  command and navigation-menu items) claim by value, so
  `aria-activedescendant`, `aria-controls` and `aria-labelledby` follow.
- **Dialog / AlertDialog Content** sets `aria-describedby` only while a
  Description is mounted (or the consumer passes one), so it never points
  at nothing.

## Coverage

| Area | Primitives | Fixed |
| --- | --- | --- |
| Overlays | dialog, alert-dialog, sheet, popover, hover-card, tooltip, menu, context-menu, menubar, navigation-menu, date-picker | dialog, alert-dialog, sheet, popover, hover-card, tooltip, menu (shared by context-menu and menubar), navigation-menu (Content gains `id`) |
| Lists | select, combobox, listbox, command | all four |
| Disclosure | tabs, accordion, collapsible | all three (CollapsibleContent gains `id`) |
| Forms | label/field, number-field, pin-input, file-drop, and the rest | field (control, label, description, error), number-field, pin-input (Root `id` lands on the input), file-drop (new `inputId`) |
| Already correct | checkbox, switch, radio-group, slider, tags-input, date-field, calendar, color-picker, tree, splitter, avatar | covered by tests |

Primitives that generate no ids: toggle, toolbar, pagination, progress,
separator, portal, toast, scroll-area.

## Tests

- **Unit tests:** `packages/primitives/tests/consumer-ids*.test.ts`, run
  through `tests/support/id-cases.ts`. For each primitive:
  - the consumer ids are kept on the right roles;
  - a `<label for>` names the control (`getByLabelText`);
  - the listed references equal the consumer ids;
  - no IDREF in the document dangles (`tests/support/id-refs.ts`).
- **Behavior rows:** `consumer-ids` in `tests/behavior/scenarios/select.spec.ts`
  (`?ids=1`) and `combobox.spec.ts`.
