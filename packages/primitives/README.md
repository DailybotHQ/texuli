# @texuli/primitives

Owned, headless Svelte 5 primitives from [Texuli](https://texuli.com), an
MIT-licensed component library by Dailybot, Inc. (*Small pieces. Infinite
possibilities.*). Each primitive implements the behavior of a WAI-ARIA
Authoring Practices pattern (roles, keyboard, focus, dismissal, form
participation) and renders unstyled markup, so you bring your own design.

Use it when you are building a design system or styled components on
Svelte 5 and want accessible behavior you do not have to write yourself.
For ready-styled components, use [`texuli`](https://www.npmjs.com/package/texuli),
which is built on these primitives. They are built from scratch on the
[`@texuli/core`](https://www.npmjs.com/package/@texuli/core) texels and do
not depend on any other component library.

> **Status: 0.x release.** Texuli is in development. The packages are
> published to npm as `0.11.1`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.12.0`) may contain breaking
> changes, so pin the exact version or use `^0.11.0`, which accepts only 0.11.x.

## Install

```bash
npm install @texuli/primitives
```

```bash
pnpm add @texuli/primitives
# or
yarn add @texuli/primitives
```

- **Peer dependency:** `svelte` `^5.57.2`.
- **Bundler:** the package ships Svelte components, so use a Svelte 5 aware
  setup: Vite with `@sveltejs/vite-plugin-svelte`, SvelteKit, or Astro with
  `@astrojs/svelte`.
- **CSS:** none. The primitives are headless; style them with your own
  classes.

## Quick start

Every primitive is a compound component. Import it as a namespace from its
subpath:

```svelte
<script lang="ts">
  import * as Dialog from '@texuli/primitives/dialog';

  let open = $state(false);
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>Open settings</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-backdrop" />
    <Dialog.Content class="dialog-panel">
      <Dialog.Title>Settings</Dialog.Title>
      <Dialog.Description>Manage your workspace preferences.</Dialog.Description>
      <Dialog.Close>Done</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

The dialog traps focus, makes the rest of the page inert, locks scrolling,
closes on Escape or a backdrop press, and returns focus to the trigger. The
backdrop and panel styles are yours.

The root entry (`@texuli/primitives`) re-exports every primitive; import
from subpaths to keep bundles narrow.

## What's inside

42 primitives, one subpath each (`@texuli/primitives/<subpath>`):

| Purpose | Subpaths |
| --- | --- |
| Overlays | `dialog`, `alert-dialog`, `sheet`, `popover`, `hover-card`, `tooltip`, `toast`, `portal` |
| Menus and navigation | `menu`, `context-menu`, `menubar`, `navigation-menu`, `command`, `toolbar`, `tabs`, `pagination` |
| Selection and lists | `select`, `combobox`, `listbox`, `tree`, `sortable` (new in `0.4.0`) |
| Form controls | `label`, `checkbox`, `switch`, `radio-group`, `toggle`, `slider`, `number-field`, `pin-input`, `tags-input`, `color-picker`, `file-drop` |
| Dates | `calendar`, `date-field`, `date-picker` |
| Disclosure and layout | `accordion`, `collapsible`, `splitter`, `scroll-area`, `separator` |
| Display | `avatar`, `progress` |

## Key guarantees

- **WAI-ARIA Authoring Practices.** Each primitive follows its APG pattern
  for roles, states and keyboard interaction, and each is exercised by a
  browser behavior suite covering keyboard, focus, ARIA and axe checks.
- **Shared layering.** Escape reaches only the topmost layer, so nested
  dialogs, menus and popovers close in order; overlays portal through one
  implementation.
- **Your handlers add, never replace.** A handler you pass to a part that
  binds its own (`onclick` on a radio item, tab or toggle, `onkeydown` on a
  listbox or calendar grid, `oninput` on the pin input…) runs first, and the
  part's behavior still runs; call `event.preventDefault()` in a click or
  key handler to skip it. Bookkeeping handlers (focus, input, pointer up)
  always run. Handlers a part fully owns are left out of its prop types.
  The two composers are public from `@texuli/primitives` for parts you build
  yourself: `composeHandlers(callerHandler, own)` (`own` is skipped when the
  caller called `preventDefault()`) and `chainHandlers(callerHandler, own)`
  (`own` always runs).
- **`bind:ref` and rest attributes on every part.** Every part that renders
  an element takes `bind:ref` (that element) and puts the attributes it does
  not consume on it. Roots that only hold state (menu, select, popover,
  dialog, tooltip roots) and portals render no element and take neither.
  `tests/contract.test.ts` checks every exported part
  ([Component API contract](https://github.com/DailybotHQ/texuli/blob/main/docs/STANDARDS.md#component-api-contract)).
- **Your ids win.** An `id` you pass on any part replaces the generated one,
  and every `aria-*` reference to that part follows it.
- **Native forms.** Checkbox, switch, radio group, select, combobox, slider,
  number field and tags input participate in native `<form>` submission.
- **Right-to-left.** Composite widgets read the document direction and
  mirror horizontal arrow keys in right-to-left layouts.
- **Safe sources.** Avatar images and toolbar and navigation-menu links pass
  the core URL policy. Avatar images default to the `untrusted` tier; links
  default to `developer`, so set `hrefTrust="untrusted"` for agent or user
  content.
- **No HTML sinks.** Content renders through Svelte snippets and text,
  never `{@html}`.
- **Dependency-free dates.** `calendar`, `date-field` and `date-picker`
  compute dates with [`@texuli/date`](https://www.npmjs.com/package/@texuli/date)
  and label them with `Intl.DateTimeFormat`. Only the Gregorian calendar is
  supported; `CalendarDate` is re-exported from `@texuli/date`.

### New in 0.8.0

Ships in `0.8.0`; the `0.7.0` release predates it: the labels primitives write themselves
resolve through the `@texuli/core/i18n` message catalog (ADR-016):
`setI18nContext`, `useMessages` and `PRIMITIVES_MESSAGES_EN` (every label id
with its English default); instance props keep winning, and English stays
the only shipped language
([i18n](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/i18n.md)).

### New in 0.6.0

Ships in `0.6.0`; the `0.5.0` release predates it. Under `0.x` the new minor
may break; see [RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md).

- **One API contract:** `bind:ref` on every rendering part (menus,
  combobox, select, popover, navigation menu, sheet, command, radio, number
  field, tooltip and the rest) and rest attributes on its root, checked by
  `tests/contract.test.ts` over every export
  ([STANDARDS](https://github.com/DailybotHQ/texuli/blob/main/docs/STANDARDS.md#component-api-contract)).
- **Caller handlers compose on more parts** (caller first;
  `event.preventDefault()` skips the part's action): menu items (focus and
  blur; every handler of checkbox and radio items and sub-triggers), the
  navigation menu root, list, trigger and link, toast roots and viewports,
  the tree, splitter handles and the command input.
- **Motion hooks:** overlay contents take `motionHooks` (enter, and an exit
  that keeps the closed part mounted and `inert` until it ends)
  ([prim-dialog](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/prim-dialog.md#motion-hooks)).
- `TagsInput.Root` `readonly` and a list or RegExp `delimiter`
  (`isDelimiterKey`, G60, G61); `DateField.Root` and `TimeField.Root`
  `inputId`, with `aria-describedby` and `aria-invalid` on their segments
  (G63); calendar `onFocusedValueChange` (G64); a date only for a
  four-digit year (G65, **breaking**); `DateRangePicker.Field` `required`
  and `onInvalid(text, reason, { side })` (G66); toast viewports `active`,
  `mode="contained"` and `container` (G77); the avatar's loading image
  hidden by style, never `[hidden]` (G79); backdrops that stay under
  overlays opened inside a modal (G75).
- `ScrollArea.Corner` `forceMount`, `Command.Input` `onkeydown`, and rest
  attributes on `CollapsibleContent` and `NavigationMenu.Content`.
- `AccordionRootProps` and `SliderRootProps` members are type aliases a
  consumer's checker can key (TS2590).

### New in 0.5.0

Ships in `0.5.0` (the `0.4.0` release predates it): caller handlers compose with
the parts' own instead of replacing them, the `date-field` `TimeField`
spins with the APG spinbutton keys, the calendar and date picker's `today`, `weekStartsOn` and range options, `ToggleGroup`
`name` and its first-pressed Tab stop, and `PinInput.Root` `name` and
`inputRef` ([prim-calendar](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/prim-calendar.md),
[prim-date-field](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/prim-date-field.md),
[prim-toggle](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/prim-toggle.md)).

### New in 0.4.0

`sortable` (`Sortable.Root`, `List`, `Item`, `Handle`) ships in `0.4.0`; it
is not in `0.3.0`. It binds the drag engine
[`@texuli/drag`](https://github.com/DailybotHQ/texuli/blob/main/packages/drag/README.md),
which is in development and on npm as `0.8.0`
([RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).
Contract: [prim-sortable.md](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/prim-sortable.md).

### Breaking in 0.3.0

`@texuli/primitives` no longer depends on `@internationalized/date`.
`CalendarDate` now comes from `@texuli/date`, and `CalendarIdentifier` is
narrowed to `'gregory'`, so code that passed another calendar system (or a
`CalendarDate` built with `@internationalized/date`) must move to
`@texuli/date`. The calendar entry fell from about 13.05 to 5.15 KiB gzip and
the date picker from about 28.60 to 20.26 KiB.

## Documentation

- Website: [texuli.com](https://texuli.com) and the
  [primitives overview](https://texuli.com/primitives-page/)
- Every primitive's contract (parts, props, keyboard table):
  [packages/primitives/docs](https://github.com/DailybotHQ/texuli/tree/main/packages/primitives/docs),
  for example [prim-dialog.md](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/prim-dialog.md),
  [prim-menu.md](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/prim-menu.md)
  and [prim-combobox.md](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/prim-combobox.md)
- Dates: [prim-calendar.md](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/prim-calendar.md)
  and [prim-date-picker.md](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/prim-date-picker.md)
- Messages (i18n, new in 0.8.0): [i18n.md](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/i18n.md)
- Consumer ids: [consumer-ids.md](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/consumer-ids.md)
- How the texels bind to Svelte 5 attachments: [svelte-attachments.md](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/svelte-attachments.md)
- Accessibility contract: [ACCESSIBILITY.md](https://github.com/DailybotHQ/texuli/blob/main/docs/ACCESSIBILITY.md)

## Related packages

- [`@texuli/core`](https://www.npmjs.com/package/@texuli/core): the framework-free behavior these primitives are built on.
- [`@texuli/date`](https://www.npmjs.com/package/@texuli/date): the dependency-free Gregorian dates behind the calendar and date pickers.
- [`texuli`](https://www.npmjs.com/package/texuli): styled components built on these primitives.
- [`@texuli/tokens`](https://www.npmjs.com/package/@texuli/tokens): the theme engine and design tokens.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-primitives).
