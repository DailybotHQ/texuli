# Generic app shells

**Package:** `texuli` · **Import:** `texuli/layouts/shells` ·
**Path:** `src/layouts/shells/` · **Task:** T-shells

A generic app frame with slots for a sidebar, header, command bar, main content,
bottom navigation and a notification center. It has no prototype chrome: device
frames, browser frames and desktop window frames are not part of Texuli. A
prototyping tool such as Protoyard draws those around the shell.

```svelte
<script lang="ts">
import { AppShell } from 'texuli/layouts/shells';
let navOpen = $state(false);
</script>

<AppShell bind:sidebarOpen={navOpen} sidebarLabel="Navigation">
  {#snippet sidebar()}<MySidebar />{/snippet}
  {#snippet header()}<MyHeader />{/snippet}
  {#snippet commandBar()}<MySearch />{/snippet}
  {#snippet notifications()}<MyToasts />{/snippet}
  <MyScreen />
</AppShell>
```

## Props

| Prop | Default | Role |
| --- | --- | --- |
| `sidebar`, `header`, `commandBar`, `bottomNav`, `notifications` | — | Snippets. Each slot renders only when it is given |
| `children` | required | The main content |
| `sidebarOpen` | `false` | The narrow-shell drawer (bindable) |
| `sidebarLabel` | `Navigation` | Names the sidebar landmark and the drawer |
| `closeLabel` | `Close navigation` | The drawer's close button |
| `skipLabel` | `Skip to content` | The skip link |
| `notificationsLabel` | `Notifications` | Names the notification region |
| `mainId` | `main-content` | `id` of the main region |
| `mainElement` | `main` | `div` for a shell nested inside another page's `<main>`. It renders no landmarks |
| `class`, `mainClass`, `sidebarClass` | — | Consumer classes, merged last |

Every label can be translated.

## Behavior

- **Wide and narrow.**
  - A shell at least 64rem wide shows the sidebar as a sticky column and hides
    the bottom navigation.
  - A narrower shell hides the column and shows the bottom navigation, and
    the sidebar opens in a drawer.
  - The breakpoint is a container query on the shell, not on the window, so a
    shell inside a preview frame follows its own box.
- **The drawer** is `texuli/layouts/host/drawer`, built on the owned dialog
  primitive.
  - It loads on its first open, so an app that is always wide never downloads
    it.
  - It closes on Escape, its close button, the backdrop, a link inside it, and
    in-app navigation (`hashchange` or `popstate`).
  - It also closes once the shell is 1024 px wide or more, so focus is never
    trapped in a drawer you can't see.
  - The drawer copy of the sidebar renders inside `DrawerScope`, and
    `isInDrawer()` lets a sidebar adapt.
- **Context.** `getAppShellContext()` gives a header or sidebar `sidebarOpen`,
  `openSidebar`, `closeSidebar` and `toggleSidebar`. It returns `undefined`
  outside a shell, so a header can hide its menu button.
- **Skip link.** It is the first focusable element and is visible only on
  focus. It moves focus to main without changing the hash, so hash routers
  are unaffected.
- **Landmarks.** The shell renders an `aside` for the sidebar, `main` for the
  content, and a named `section` for the notifications. With
  `mainElement="div"` it renders plain `div`s.
- **Notifications** are pinned to the block-end, inline-end corner (bottom
  right in LTR, bottom left in RTL). They respect the safe area.
- **Styles** are in `@layer tx.components` and use only logical properties and
  `--tx-*` tokens, with system-color fallbacks.

## Verified

- `pnpm vitest run packages/texuli/tests/navigation.test.ts packages/texuli/tests/contracts.test.ts -t '^shells '`: 7 tests.
  - The skip link; nested mode without landmarks.
  - The drawer: the bound prop, following a link, and closing at the
    1024 px boundary (1023 stays open).
  - No context outside a shell.
  - The source imports nothing from Protoyard or Lucide, and its CSS
    uses no physical properties.
- A one-off probe in Chromium and WebKit (2026-10-23), at 1280 px and 600 px:
  - The column shows only when the shell is wide.
  - The skip link appears on focus, focuses main and leaves the hash
    untouched.
  - Notifications sit in the corner.
  - The drawer opens, closes on Escape, and closes when the viewport is
    widened.
  - There were no console errors.

## Size

`pnpm size` (2026-10-24): `texuli/layouts/shells` is **2.55 KiB gzip JS** and
**1.66 KiB CSS**, within the 12 KiB `texuli/*` budget. The drawer is a
separate **12.89 KiB** lazy chunk.

## Limits

- No registered example or visual baselines yet.
- The breakpoint is fixed at 64rem. Restyle the slots with consumer classes
  to change the layout.
- The first drawer open waits for the chunk to load.
