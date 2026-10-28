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
> published to npm as `0.4.0`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.5.0`) may contain breaking
> changes, so pin the exact version or use `^0.4.0`, which accepts only 0.4.x.

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

### New in 0.4.0

`sortable` (`Sortable.Root`, `List`, `Item`, `Handle`) ships in `0.4.0`; it
is not in `0.3.0`. It binds the drag engine
[`@texuli/drag`](https://github.com/DailybotHQ/texuli/blob/main/packages/drag/README.md),
which is in development and on npm as `0.4.0`
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
