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
> published to npm as `0.3.0`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.4.0`) may contain breaking
> changes, so pin the exact version or use `^0.3.0`, which accepts only 0.3.x.

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
  Component styles load with each component.

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
| Forms | `field` (Field, Label, Description, FieldError, Form), `input` (Input, InputGroup, Textarea), `choice` (Checkbox, Radio, Switch), `select`, `combobox` (Combobox, MultiSelect), `number-pin` (NumberField, PinInput), `slider`, `date` (Calendar, DatePicker, DateRangePicker), `tags-color` (TagsInput, ColorPicker), `file-upload`, `rating` |
| Overlays | `dialog` (Dialog, AlertDialog), `sheet` (Sheet, Drawer, DetailPanel, ResponsiveModal), `popover` (Popover, HoverCard), `tooltip`, `toast` (Toaster), `menus` (DropdownMenu, ContextMenu, Menubar), `command` (command palette) |
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
| `layouts/content/{blog,docs,editorial}` | Content page layouts |
| `layouts/mobile` | Mobile tabs and drawer layouts (registered for the layout host) and their navigation model helpers |
| `layouts/host` (plus `/chrome`, `/drawer`) | `LayoutHost`: lazy layout resolution with responsive fallbacks, shared chrome and a data-only nav model |

The `layouts/{mobile,dashboard,marketing,auth-settings}/register` subpaths
register a layout family with the host without pulling its components into
the initial chunk.

### Helpers

`texuli/cx` exports `cx` (class composition) and `variants` (typed variant
recipes), so you can extend components without `clsx` or `tailwind-merge`.

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
- Icons: [ui-icons.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/ui-icons.md)
- Layouts: [layouts-shells.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/layouts-shells.md)
  and [layouts-dashboard.md](https://github.com/DailybotHQ/texuli/blob/main/packages/texuli/docs/layouts-dashboard.md)

## Related packages

- [`@texuli/tokens`](https://www.npmjs.com/package/@texuli/tokens): the theme engine and design tokens these components read.
- [`@texuli/primitives`](https://www.npmjs.com/package/@texuli/primitives): the headless primitives underneath.
- [`@texuli/core`](https://www.npmjs.com/package/@texuli/core): framework-free behavior and URL policy.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc.
