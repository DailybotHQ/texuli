# LayoutHost and the layout contract

**Package:** `texuli` · **Import:** `texuli/layouts/host`

Lazy layout resolution with responsive fallbacks, a stable screen outlet,
shared chrome helpers and a data-only nav model. Layout types are owned here
(no zod, no `@protoyard`). Width is measured with `ResizeObserver` after mount
— seeded from the container (or the viewport before mount) so a desktop host does not flash a mobile fallback; then kept live with `ResizeObserver`. Never read `window` at module import.

## API

```svelte
<script lang="ts">
  import {
    LayoutHost,
    layoutForWidth,
    registerLayout,
    type NavModel,
  } from 'texuli/layouts/host';

  registerLayout('sidebar', {
    load: () => import('./MySidebarLayout.svelte'),
  });

  const nav: NavModel = {
    brand: { label: 'Harbor', href: '#/' },
    sections: [
      {
        id: 'main',
        items: [{ id: 'home', label: 'Home', href: '#/' }],
      },
    ],
  };
</script>

<LayoutHost layout="sidebar" {nav} dir="ltr">
  {#snippet children()}
    <slot />
  {/snippet}
</LayoutHost>
```

| Export | Role |
| --- | --- |
| `LayoutHost` | Resolves id → fallback by width, lazy-loads layout, keeps screen DOM |
| `layoutForWidth` / `LAYOUTS` / `LayoutId` | Catalog and pure resolution |
| `registerLayout` | Fill `LAYOUT_REGISTRY` as layout modules ship |
| `NavModel` / `resolveNav` | Path-driven active trail |
| `LayoutChrome` | Skip / brand / actions / user (`safeHref`) |
| `NavIcon` / `navIconPath` / `NAV_ICON_BUILTINS` | Nav icon by name (each known name has its own glyph: home, inbox, settings, search, user, users, calendar, charts, file, folder, bell, mail and more) or by component; unknown names draw a neutral dot, never the menu glyph |
| `LayoutDrawer` | Breakpoint drawer on primitives dialog |
| `layoutStorageKey` / `readFlag` / `writeFlag` | Persisted chrome flags |

## RTL

Pass `dir="rtl"` on `LayoutHost`. Chrome and drawer use logical CSS properties
(`inset-inline-*`, `padding-inline`).


## Host viewport contract

Framed previews (device shells, gallery iframes) should set these CSS variables
on the frame or a parent of `LayoutHost`:

| Token | Default (tokens `base.css`) | Purpose |
| --- | --- | --- |
| `--tx-app-height` | `100dvh` | Height of the app surface inside the frame |
| `--tx-app-shell-height` | `var(--tx-app-height)` | Alias used by generic shells |
| `--tx-safe-top` | `env(safe-area-inset-top, 0px)` | Top safe inset |
| `--tx-safe-right` | `env(safe-area-inset-right, 0px)` | Right safe inset |
| `--tx-safe-bottom` | `env(safe-area-inset-bottom, 0px)` | Bottom safe inset |
| `--tx-safe-left` | `env(safe-area-inset-left, 0px)` | Left safe inset |

Layouts and shells use **only** these tokens (no raw `100dvh` / `100vh` /
`env(safe-area-*)` in layout CSS). A host can set e.g.
`--tx-app-height: 100%` and zero safe insets inside a phone frame.

## Layout registration ownership

Each layout id has one owner module (`app`, `mobile`, `dashboard`, …).
`registerAppLayouts()` does **not** register `mobile-drawer` / `mobile-tabs`;
call `registerMobileLayouts()` for those. Re-registering an id from a
**different** owner with a different loader logs a development warning.
