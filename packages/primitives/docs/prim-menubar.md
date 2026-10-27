# Menubar

**Package:** `@texuli/primitives` · **Import:**
`import * as Menubar from '@texuli/primitives/menubar'` (also `Menubar` from
`@texuli/primitives`)

An owned, headless application menubar that follows the WAI-ARIA
[Menubar](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) pattern:
- roving top-level items
- moving between menus with the arrow keys
- opening on hover after the first open

It is built on the owned Menu primitive (`docs/prim-menu.md`), and its parts
are composed as `Menubar.*`.

```svelte
<script lang="ts">
  import * as Menubar from '@texuli/primitives/menubar';
  let value = $state('');
</script>

<Menubar.Root bind:value aria-label="Application">
  <Menubar.Menu value="file">
    <Menubar.Trigger>File</Menubar.Trigger>
    <Menubar.Content>
      <Menubar.Item onSelect={() => create()}>New</Menubar.Item>
      <Menubar.Sub>
        <Menubar.SubTrigger>Share</Menubar.SubTrigger>
        <Menubar.SubContent>
          <Menubar.Item>Email</Menubar.Item>
        </Menubar.SubContent>
      </Menubar.Sub>
    </Menubar.Content>
  </Menubar.Menu>
  <Menubar.Menu value="edit">
    <Menubar.Trigger>Edit</Menubar.Trigger>
    <Menubar.Content>…</Menubar.Content>
  </Menubar.Menu>
</Menubar.Root>
```

## Parts

| Part | Element and role | Props |
| --- | --- | --- |
| `Root` | `div role="menubar"`, `aria-orientation="horizontal"`, `data-state` `open` or `closed` | `bind:value` (the open menu, `''` for none), `onValueChange`, `loop` (default `true`), `dir`, `child`, `ref`. Name it with `aria-label` |
| `Menu` | — | `value` (unique; generated when omitted), `onOpenChange` |
| `Trigger` | `button role="menuitem"`, `aria-haspopup="menu"`, `aria-expanded`, `data-state`, roving `tabindex` | `disabled`, and button attributes |
| `Content` | `div role="menu"` (the Menu primitive's) | `side`, `align`, `sideOffset`, and attributes |
| `Item`, `CheckboxItem`, `RadioGroup`, `RadioItem`, `Group`, `GroupHeading`, `Separator`, `Sub`, `SubTrigger`, `SubContent`, `Portal` | the Menu primitive's parts | see `docs/prim-menu.md` |

## Keyboard (APG)

| Key | On a trigger | In a menu |
| --- | --- | --- |
| ArrowRight / ArrowLeft (swapped in RTL) | Next or previous trigger; disabled triggers are skipped; wraps unless `loop={false}`. When a menu is open, the new trigger's menu opens on its first item | Close this menu and open the next or previous one on its first item. On a submenu trigger, ArrowRight opens the submenu; inside a submenu, ArrowLeft closes it and ArrowRight on a plain item moves to the next menu |
| Home / End | First or last trigger | First or last item (Menu) |
| Enter, Space, ArrowDown | Open the menu on its first item | Run the item (Menu) |
| ArrowUp | Open the menu on its last item | Previous item (Menu) |
| Escape | — | Close the menu and return focus to its trigger |
| Tab | Leave the menubar: it is a single Tab stop, and the last focused trigger keeps it | Close the menu and return to the trigger (Menu) |

Keys held with Ctrl, Meta or Alt are left to the platform.

## Pointer and touch

- **Click:** a click on a trigger toggles its menu. Clicking another trigger
  switches menus.
- **Hover after the first open:** once a menu is open, hovering another
  trigger with a mouse switches to its menu. Before that, hovering does
  nothing. Touch has no hover, so only a tap opens.
- **Outside press:** a press outside closes the open menu (the Menu
  primitive's dismiss).

## Behavior (`tests/behavior/scenarios/menubar.spec.ts`)

12 rows:
- roles
- one Tab stop
- arrows between triggers
- open on the first item
- arrows carrying an open menu
- submenu keys
- Escape returning focus
- hover after the first open
- outside press
- selection
- touch tap
- axe with a menu open

Results:
- It passes **all 12** on Chromium, WebKit and the Pixel 7, including
  `outside-press`: a press outside closes the menubar's open menu.
- The hover row checks nothing on touch projects, and the touch row checks
  nothing on desktop projects.

## Size

`@texuli/primitives/menubar` is **17.49 KiB gzip** (`pnpm size`, 2026-10-24),
within its 22 KiB budget. That is **1.02 KiB on top of**
`@texuli/primitives/menu` (16.47 KiB), within the task's ≤ 3 KB.

## Tests

```bash
pnpm vitest run packages/primitives/tests/overlays.test.ts
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/menubar.spec.ts
```

The 4 unit tests (`-t menubar`) cover what the behavior rows do not:
- the arrows swapped in RTL
- carrying the open menu from inside it
- hover only after the first open (not on touch)
- the controlled `value`

## Limits

- Menus open below their trigger (`side="bottom"`, `align="start"`); pass
  `side` and `align` to `Content` to change it.
- The `child` snippet is available on `Root`. `Trigger` renders the Menu
  primitive's button, because the button is what registers the trigger for
  focus return and positioning.
