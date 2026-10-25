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
