# texuli

Styled, accessible Svelte 5 components, layouts and app shells from
[Texuli](https://texuli.com), an MIT-licensed component library by Dailybot,
Inc. (*Small pieces. Infinite possibilities.*). Every component composes an
owned headless primitive from
[`@texuli/primitives`](https://www.npmjs.com/package/@texuli/primitives)
with the theme engine in
[`@texuli/tokens`](https://www.npmjs.com/package/@texuli/tokens), so you get
keyboard support, focus management and theming out of the box.

Use it to build Svelte 5 apps, dashboards and sites without writing
component behavior or design tokens yourself: 41 component families plus
layouts for dashboards, marketing pages, auth and settings, content and
mobile.

> **Status: 0.x release.** Texuli is in development. The packages are
> published to npm as `0.9.0`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.10.0`) may contain breaking
> changes, so pin the exact version or use `^0.9.0`, which accepts only 0.9.x.

## Install

```bash
npm install texuli @texuli/tokens
```

```bash
pnpm add texuli @texuli/tokens
# or
yarn add texuli @texuli/tokens
```

- **Peer dependency:** `svelte` `^5.57.2`.
- **Bundler:** the package ships Svelte components that import their own
  CSS, so use a Svelte 5 aware setup: Vite with
  `@sveltejs/vite-plugin-svelte`, SvelteKit, or Astro with `@astrojs/svelte`
  (in Astro, add `vite.ssr.noExternal: ['texuli', /^@texuli\//]`).
- **CSS:** import `@texuli/tokens/base.css` once and apply a theme (below).
  Component styles load with each component. **This import is required:**
  component CSS reads the system tokens (`--tx-space-unit`,
  `--tx-size-icon-sm`, `--tx-shape-radius-*`…) with no fallback, and only
  `base.css` declares them, so a host with its own reset that skips it gets
  controls with no size. Such a host can load `@texuli/tokens/system.css`
  instead (unreleased, `0.10.0`): the system token defaults alone, with no
  reset.

## Quick start

Wire the tokens once, in your app's entry module:

```ts
import '@texuli/tokens/base.css';
import { applyTheme } from '@texuli/tokens/css';
import { loadLibraryTheme } from '@texuli/tokens/library';

loadLibraryTheme('enterprise-neutral').then((theme) => {
  applyTheme(document.documentElement, { theme, mode: 'light' });
});
```

Then import components from their subpaths:

```svelte
<script lang="ts">
  import { Button } from 'texuli/button';
  import { Card, CardContent, CardHeader, CardTitle } from 'texuli/card';
</script>

<Card>
  <CardHeader>
    <CardTitle>Invoices</CardTitle>
  </CardHeader>
  <CardContent>
    <Button variant="outline" size="sm" onclick={() => console.log('export')}>
      Export
    </Button>
  </CardContent>
</Card>
```

Each `texuli/<family>` subpath exports the family's Svelte components, its
variant constants and its class helpers. The root entry (`texuli`)
re-exports every family; subpaths keep bundles narrow.

## What's inside

### Components

| Purpose | Subpaths |
| --- | --- |
| Actions | `button` (Button, IconButton, ButtonGroup), `toggle` (Toggle, ToggleGroup), `kbd-code` (Kbd, Code, CopyButton) |
| Forms | `field` (Field, Label, Description, FieldError, Form), `input` (Input, InputGroup, Textarea), `choice` (Checkbox, Radio, Switch), `select`, `combobox` (Combobox, MultiSelect), `number-pin` (NumberField, PinInput), `slider`, `date` (Calendar, DatePicker, DateRangePicker, TimeField), `tags-color` (TagsInput, ColorPicker), `file-upload`, `rating` |
| Overlays | `dialog` (Dialog, AlertDialog), `sheet` (Sheet, Drawer, DetailPanel, ResponsiveModal; `Header`, `Body`, `Footer` and `CloseButton` parts), `popover` (Popover, HoverCard), `tooltip`, `toast` (Toaster), `menus` (DropdownMenu, ContextMenu, Menubar), `command` (command palette) |
| Navigation | `navigation` (NavigationMenu, Breadcrumb, Pagination), `sidebar` (Sidebar, AppNav), `tabs-accordion` (Tabs, Accordion, Collapsible), `stepper` (Stepper, Wizard), `toolbar`, `tree` (TreeView) |
| Display | `card`, `alert` (Alert, Callout, Banner), `badge` (Badge, Tag, Chip), `avatar` (Avatar, AvatarGroup), `stat` (Stat, KPI), `table`, `timeline`, `carousel`, `empty` (EmptyState, ErrorState), `feedback` (Skeleton, Spinner, Progress) |
| Structure | `separator-aspect` (Separator, AspectRatio, VisuallyHidden), `scroll-area`, `resizable` (resizable panels) |
| Icons | `icons` (ten built-in SVG icons and the `Icon` component), `icons/lucide` (optional bridge for apps that already use `@lucide/svelte`) |

### Layouts and shells

| Subpath | What it provides |
| --- | --- |
| `layouts/shells` | `AppShell` and `DrawerScope` |
| `layouts/app`, `layouts/app/{sidebar,dual-sidebar,rail,master-detail,split-view,top-nav}` | Application layouts |
| `layouts/dashboard` | `DashboardGridLayout` and `AnalyticsGrid` |
| `layouts/marketing` (plus `/landing`, `/pricing`, `/section`, `/entry`) | Marketing pages and sections |
| `layouts/auth-settings` | Auth split, settings and wizard layouts |
| `layouts/content` | `ContentLayout` for direct use (content as children, host TOC entries, TOC levels, preserved heading ids) and the TOC helpers |
| `layouts/content/{blog,docs,editorial}` | Content page layouts |
| `layouts/mobile` | Mobile tabs and drawer layouts (registered for the layout host), their navigation model helpers, and the standalone `BottomNav`, `MobileHeader` and `MobileAppFrame` parts |
| `layouts/host` (plus `/chrome`, `/drawer`) | `LayoutHost`: lazy layout resolution with responsive fallbacks, shared chrome and a data-only nav model |

The `layouts/{mobile,dashboard,marketing,auth-settings}/register` subpaths
register a layout family with the host without pulling its components into
the initial chunk.

### Helpers

`texuli/cx` exports `cx` (class composition) and `variants` (typed variant
recipes), so you can extend components without `clsx` or `tailwind-merge`.
It also exports `composeHandlers` and `chainHandlers` (also from `texuli`),
the "caller first" handler order every component follows, for parts you
build yourself: `composeHandlers(callerHandler, own)` runs the caller's
handler, then `own` unless the caller called `event.preventDefault()`;
`chainHandlers(callerHandler, own)` always runs `own` (focus tracking, drag
state). A `callerHandler` that is not a function is ignored.

`texuli/motion` holds the motion prop contract and `MotionProvider` (new in
`0.6.0`): overlays, toasts, tabs, accordions and the
`@texuli/data` Board and DataGrid animate through `@texuli/core/motion`,
instant under reduced motion and at level `none`
([ui-motion.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-motion.md)).

`texuli/defaults` (new in `0.9.0`) holds
`setDesignDefaults`: default `variant` and `size` props from a closed,
typed vocabulary, used only when a prop is omitted. Every component also
reads its component tokens (`--tx-button-radius`, `--tx-card-padding-inline`…)
and the tier-3 hooks (`data-tx-button-style` and friends)
([design-system.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/design-system.md)).
`texuli/design-system` (unreleased, `0.10.0`) adds `DesignSystemProvider`, a
scope element that applies a compiled design system and its component
defaults ([design-system.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/design-system.md#designsystemprovider)).

## New in 0.8.0

Ships in `0.8.0`; the `0.7.0` release predates it: component labels resolve through the
`@texuli/core/i18n` message catalog (ADR-016). `setI18nContext(i18n)` puts
a catalog in context, `useMessages()` is the lookup components read, and
`TEXULI_MESSAGES_EN` lists every label id with its English default; label
props keep winning, and English stays the only shipped language
(translations beyond English are planned)
([i18n](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/i18n.md)).

## New in 0.6.0

Ships in `0.6.0`; the `0.5.0` release predates it. Under `0.x` the new minor
may break; the breaking items are marked.

- **One API contract:** `bind:ref` and rest attributes on every exported
  component (menus, combobox, select, popover, navigation, pagination,
  sheet parts, command, number field, pin input, `Radio`, `Tooltip`,
  `Calendar`, the date controls, `TagsInput`, `ColorPicker`, `Toggle` and
  more), the [Component API contract](https://github.com/DailybotHQ/texuli/blob/main/docs/STANDARDS.md#component-api-contract)
  checked by `tests/contract.test.ts`. Layouts are not under the contract
  yet (planned).
- **Motion:** `texuli/motion` (`MotionProvider`, the `motion` prop):
  dialogs, sheets, popovers, hover cards, menus, tooltips, toasts, tabs and
  accordions animate through `@texuli/core/motion`
  ([ui-motion](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-motion.md)). **Breaking:** the
  toast and tooltip CSS keyframes are gone, and a closing overlay stays
  mounted, `inert`, until its exit ends.
- **Breaking, Field ids:** `FileUpload`'s `id` (or `inputId`) reaches the
  file input and `TagsInput`'s its text input (G56, G60); the date controls
  take `hideLabel`, hide their own label inside a `Field`, and put `id` on
  their first segment (G63).
- **Breaking, `InputGroup`:** `id`, `aria-*`, `data-*` and handlers reach
  the input ([ui-input](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-input.md)).
- **Breaking, `avatar`:** `data-avatar` is `initials` after an image error
  (G58).
- `dialog`, `command`: `mode`, `container`, `onDismissRequest` and
  `onCloseAutoFocus` on `Dialog`, `AlertDialog` and `CommandPalette` (G53).
- `tabs-accordion`: the tab badge is part of the name, or `badgeLabel` (G54).
- `toast`: `action.retryOnError` and `errorText` (G57); the `Toaster` has no
  top-layer viewport while empty, and `mode="contained"` with a `container`
  (G77).
- `tags-color`: `TagsInput` `readonly` and a list or RegExp `delimiter`
  (G60, G61).
- `card`: `CardGrid` `gap` values, and a caller `style` keeps the column
  template (G62).
- `date`: `Calendar` `defaultFocusedValue`, `bind:focusedValue` and
  `onFocusedValueChange` (G64); `DateRangePicker` `required` and
  `onInvalid(text, reason, { side })` (G66).
- `layouts/content`: active-heading tracking with `aria-current="location"`,
  `activeId` and `onActiveHeadingChange` (G52).
- `layouts/mobile`: no wrapper for an empty `stickyFooter` (G68).
- `layouts/marketing` and `layouts/marketing/section`:
  `MarketingSectionHeader`, a heading-only section header with no landmark
  or padding (G84).
- `Tooltip` `bind:ref` (the tooltip element, `null` while hidden).

## New in 0.5.0

Ships in `0.5.0`; the `0.4.0` release predates it. Under `0.x` the new minor
may break; the breaking items are marked.

- **Breaking, `input`:** with `type="number"` or `type="range"`,
  `bind:value` binds a number, or `null` while empty; `type="file"` binds
  `files` as `null` until a pick. A caller `oninput` now composes with the
  internal handler instead of replacing it (it used to stop `bind:value`)
  ([ui-input](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-input.md)).
- **Breaking, `toast`:** the store owns the auto-dismiss timers;
  `onSettle(reason)` (`timeout`, `action`, `dismiss`), `pause`, `resume`,
  `isPaused` and `announcement` ([ui-toast](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-toast.md)).
- **Breaking, `badge`:** the `Tag` remove button is named after its tag
  ("Remove Design" by default; `removeLabel` customizes it)
  ([ui-badge](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-badge.md)).
- **Breaking, `layouts/content`:** `TocItem.level` and `TocHeading.level`
  widen from `2 | 3` to `2 | 3 | 4 | 5 | 6`
  ([layouts-content](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/layouts-content.md)).
- `kbd-code`: `CopyButton` takes `onCopy` and `onCopyError`.
- `date`: `today`, `weekStartsOn`, `maxDays` and `onInvalid` on `Calendar`,
  `DatePicker` and `DateRangePicker`, range highlight, and a styled
  `TimeField` ([ui-date](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-date.md)).
- Overlays: a `stack` option on `Dialog` and `AlertDialog`, focus-exempt
  regions (an undo toaster), `ResponsiveModal` `force` and host sizing, and
  the sheet `Header`, `Body`, `Footer` and `CloseButton` parts
  ([ui-dialog](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-dialog.md), [ui-sheet](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-sheet.md)).
- `layouts/content` (new subpath): `ContentLayout` with children, host TOC
  entries, TOC levels and preserved heading ids.
- `layouts/mobile`: standalone `BottomNav`, `MobileHeader` and
  `MobileAppFrame` ([layouts-mobile](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/layouts-mobile.md)).
- `bind:ref` and rest attributes on `Dialog`, `Tabs`, `Accordion`,
  `Collapsible`, `TextCounter`, `Toolbar`, `ToggleGroup` and more;
  `ToggleGroup` `name`; `PinInput.Root` `name` and `bind:inputRef`;
  `CardGrid` `maxColumns`; link `Card` `target`, `rel` and `download`;
  `FileUpload` `onFilesAdd` and `onFileRemove`; `Avatar` `srcset` and
  `sizes` through the URL policy; a bindable `TagsInput` draft; a
  `destructive` tone on menu `Item`s; tab icons; `Pagination` `stableCount`; and
  the `--tx-app-height` variable documented for `AppShell`
  ([layouts-shells](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/layouts-shells.md)).

## Key guarantees

- **Accessible by construction.** Interactive components are built on
  primitives that follow the WAI-ARIA Authoring Practices patterns for
  roles, keyboard interaction and focus.
- **Theming.** Components are styled on the `--tx-*` token contract, so any
  of the 210 library themes, or one you generate, restyles them in light and
  dark mode.
- **Your CSS wins.** Component styles live in the `tx.components` cascade
  layer; unlayered or later-layer app CSS overrides them without
  `!important`.
- **Forced colors and right-to-left.** Component stylesheets include
  forced-colors rules, and layouts use logical CSS properties.
- **URL policy.** Links and media (Button, Card, Breadcrumb, Sidebar and
  others) pass the `@texuli/core` URL policy. App-authored props default to
  the `developer` tier; set the `untrusted` tier (for example
  `hrefTrust="untrusted"`) for agent or user content.
- **No HTML sinks.** Components render text and Svelte snippets, never
  `{@html}`.

## Documentation

- Website: [texuli.com](https://texuli.com), the
  [getting started guide](https://texuli.com/guides/getting-started/), the
  [component overview](https://texuli.com/component-pages/) and the
  [examples](https://texuli.com/examples/)
- Every component and layout: [packages/texuli/docs](https://github.com/DailybotHQ/texuli/tree/main/packages/texuli/docs),
  for example [ui-button.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-button.md)
  and [ui-dialog.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-dialog.md)
- Using Texuli with your own CSS: [using-with-your-css.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/using-with-your-css.md)
- Class values and variants: [class-value.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/class-value.md)
  and [variants-css.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/variants-css.md)
- Motion: [ui-motion.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-motion.md)
- Component messages (i18n, new in 0.8.0): [i18n.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/i18n.md)
- Icons: [ui-icons.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-icons.md)
- Layouts: [layouts-shells.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/layouts-shells.md),
  [layouts-dashboard.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/layouts-dashboard.md),
  [layouts-content.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/layouts-content.md)
  and [layouts-mobile.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/layouts-mobile.md)

## Related packages

- [`@texuli/tokens`](https://www.npmjs.com/package/@texuli/tokens): the theme engine and design tokens these components read.
- [`@texuli/primitives`](https://www.npmjs.com/package/@texuli/primitives): the headless primitives underneath.
- [`@texuli/core`](https://www.npmjs.com/package/@texuli/core): framework-free behavior and URL policy.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-texuli).
