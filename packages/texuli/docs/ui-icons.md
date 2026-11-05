# Icon system

`texuli/icons` provides a small set of owned SVG icons and a component API for
consumer-supplied Svelte icons. The built-in set stays small so internal
controls do not pull in a complete icon library.

```svelte
<script lang="ts">
  import { Icon } from 'texuli/icons';
</script>

<Icon icon="search" size="sm" />
<Icon icon="warning" label="Review required" />
```

The built-in names are exported as `ICON_NAMES`: `check`, `chevron-down`,
`chevron-right`, `close`, `info`, `menu`, `minus`, `plus`, `search` and
`warning`. Sizes are `xs` (12 px), `sm` (16 px), `md` (20 px, the default) and
`lg` (24 px). The default icon is decorative (`aria-hidden="true"`). Pass a
localized `label` or `aria-label` to expose it as an image with an accessible
name. Icons inherit `currentColor` and accept a consumer `class` after the
base and size classes.

## Register your own names

New in `0.13.1`. An app adds its own vocabulary with `registerIcons`, then
uses the names like the built-ins:

```svelte
<!-- +layout.svelte (or the app root) -->
<script lang="ts">
  import { Rocket } from '@lucide/svelte';
  import { Icon, registerIcons } from 'texuli/icons';

  registerIcons({
    rocket: Rocket, // a Svelte SVG component (Lucide icons work as is)
    spark: 'M12 3v18M3 12h18', // or the built-in shape: one path d on a 24x24 viewBox
  });
</script>

<Icon icon="rocket" label="Launch" />
```

- **Values.** A Svelte SVG component (`IconComponent`), or a path `d` string
  drawn like the built-ins (stroked, `currentColor`, 24×24 viewBox). The
  string only ever becomes a `<path d>` attribute; nothing is parsed as
  markup.
- **Scope and SSR.** The registry lives in Svelte context, not in a module
  global, so it is SSR-safe: a server render never sees another request's
  icons. Call `registerIcons` in a component's script (the app root or a
  layout); it covers every `Icon` below that component. `<IconsProvider
  icons={…}>` does the same as a wrapper, renders no element and updates
  its icons in place when `icons` changes. A nested registration layers over
  the one above it: its names win, the rest fall through.
- **Built-ins win.** The built-in names (`ICON_NAMES`) keep their glyphs, so
  internal controls look the same under any registry.
- **Unknown names** render nothing, unless the registry has a `fallback`
  (below).
- **Types.** Augment `IconNames` so `icon` autocompletes and checks the
  registered names (`IconName` is the built-in names plus these):

  ```ts
  declare module 'texuli/icons' {
    interface IconNames {
      rocket: true;
      spark: true;
    }
  }
  ```

  Names that come from data at runtime can be cast (`name as IconName`).

The prop stays `icon` (no `name` alias). A registered icon's `<svg>` carries
`data-tx-icon="<name>"`.

## Lazy icons and a fallback

New in `0.14.0`. A registered value can also be a loader, so a large icon set
only downloads the glyphs a page draws. `fallback` (a built-in name or a
glyph) is drawn for names the registry does not know, and for a lazy icon
until it loads:

```svelte
<script lang="ts">
  import { registerIcons } from 'texuli/icons';

  registerIcons(
    {
      rocket: () => import('@lucide/svelte/icons/rocket'),
      spark: () => Promise.resolve('M12 3v18M3 12h18'),
    },
    { fallback: 'info' }
  );
</script>
```

`<IconsProvider icons={…} fallback="info">` takes the same values.

- **Loaders.** A loader takes no arguments and returns a promise of a module
  whose default export is a glyph (what `import()` of a Lucide icon gives),
  or of a glyph itself (`IconLoader`). It runs once per registry, the first
  time an `Icon` asks for the name; every `Icon` with that name waits on the
  same load and redraws when it lands.
- **Until it loads** the `Icon` draws the fallback, or nothing without one.
- **Errors.** A loader that rejects, throws or resolves to something that is
  not a glyph is treated as missing: the fallback (or nothing) stays, and
  nothing is thrown.
- **SSR.** Nothing loads on the server: a lazy icon renders the fallback (or
  nothing), and the first client render draws the same, so hydration
  matches; the glyph replaces it once loaded.
- **Nesting.** A nested registry's own glyphs win, then the ones above it;
  the nearest `fallback` applies only when none of them has the name.
- **Cost.** The loading and fallback logic ships with `registerIcons` and
  `IconsProvider` in `texuli/icons`; the root `Icon` only reads the
  registry, so apps that register nothing pay nothing.

## Optional Lucide bridge

Texuli does not install or bundle Lucide. Consumers that already use
`@lucide/svelte` can import its icons and use the isolated bridge subpath:

```svelte
<script lang="ts">
  import { Search } from '@lucide/svelte';
  import { LucideIcon } from 'texuli/icons/lucide';
</script>

<LucideIcon icon={Search} size="sm" label="Search" />
```

`IconComponent` is also exported as `LucideIconComponent` from that subpath
for navigation and other data contracts. Apps using only the built-in set do
not import the bridge or need a Lucide dependency.

The `texuli-icons` example covers all built-in names, each size, decorative
and named states, a compatible custom SVG component, RTL and dark mode. Its
browser example is checked with axe and has committed light/dark desktop and
mobile visual baselines.

<!-- tokens:start (generated by `pnpm exec tsx packages/tokens/scripts/generate.ts`; do not edit by hand) -->
## Tokens

Set these on any element above the component (a theme scope, a design
system scope or `data-tx-scope`); each defaults to the system or theme token
shown, so nothing changes until one is set. The full list, with the exact
read expressions, is in
[tokens-components](../../tokens/docs/tokens-components.md#component-tokens).

| Token | Default | Meaning |
| --- | --- | --- |
| `--tx-icon-size-xs` | `var(--tx-size-icon-xs)` | Size xs. |
| `--tx-icon-size-sm` | `var(--tx-size-icon-sm)` | Size sm. |
| `--tx-icon-size-md` | `var(--tx-size-icon-md)` | Size md (the default). |
| `--tx-icon-size-lg` | `var(--tx-size-icon-lg)` | Size lg. |
| `--tx-icon-stroke-width` | `var(--tx-icon-stroke)` | Stroke width. |

<!-- tokens:end -->
