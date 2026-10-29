# Menu (dropdown)

**Package:** `@texuli/primitives` · **Import:** `import * as Menu from '@texuli/primitives/menu'` (also `Menu` from `@texuli/primitives`)

A headless dropdown menu following the WAI-ARIA [menu button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) and [menu](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) patterns:
- items, checkbox items, radio items, groups and separators;
- submenus with a pointer grace area;
- typeahead.

It is built on the texels. Part names follow the common dropdown-menu API, so a port is a rename.

```svelte
<script lang="ts">
  import * as Menu from '@texuli/primitives/menu';
  let open = $state(false);
  let grid = $state(false);
  let density = $state('comfortable');
</script>

<Menu.Root bind:open>
  <Menu.Trigger>View</Menu.Trigger>
  <Menu.Content sideOffset={4}>
    <Menu.Item onSelect={() => create()}>New file</Menu.Item>
    <Menu.Sub>
      <Menu.SubTrigger>Export</Menu.SubTrigger>
      <Menu.SubContent>
        <Menu.Item onSelect={() => exportAs('png')}>PNG</Menu.Item>
      </Menu.SubContent>
    </Menu.Sub>
    <Menu.CheckboxItem bind:checked={grid}>Show grid</Menu.CheckboxItem>
    <Menu.Separator />
    <Menu.RadioGroup bind:value={density}>
      <Menu.GroupHeading>Density</Menu.GroupHeading>
      <Menu.RadioItem value="compact">Compact</Menu.RadioItem>
      <Menu.RadioItem value="comfortable">Comfortable</Menu.RadioItem>
    </Menu.RadioGroup>
  </Menu.Content>
</Menu.Root>
```

## Parts

| Part | Element and role | Props |
| --- | --- | --- |
| `Root` | — | `bind:open`, `onOpenChange`, `loop` (arrows wrap; default `true`) |
| `Trigger` | `button`, `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` while open, `data-state` | `child` snippet for composition; button attributes |
| `Portal` | — | Renders its children in place. Content already shows in the top layer; the part exists for API symmetry with the other overlays |
| `Content` | `div role="menu"` labelled by the trigger, `data-state="open"` | `side` (`bottom`), `align` (`start`), `sideOffset` (`4`), attributes |
| `Item` | `role="menuitem"`, `aria-disabled`, `data-disabled`, `data-highlighted` | `disabled`, `textValue` (typeahead text), `onSelect(event)` (call `preventDefault()` to keep the menu open), `closeOnSelect` (`true`), `child` snippet |
| `CheckboxItem` | `role="menuitemcheckbox"`, `aria-checked` `true`/`false`/`mixed`, `data-state` | `bind:checked`, `bind:indeterminate`, `onCheckedChange`, `disabled`, `textValue`, `onSelect`, `closeOnSelect`; `children({ checked, indeterminate })` |
| `RadioGroup` | `role="group"` named by its heading | `bind:value`, `onValueChange` |
| `RadioItem` | `role="menuitemradio"`, `aria-checked`, `data-state` | `value`, `disabled`, `textValue`, `onSelect`, `closeOnSelect`; `children({ checked })` |
| `Group` / `GroupHeading` | `role="group"`, named by the heading's id | — |
| `Separator` | `role="separator"` | — |
| `Sub` | — | `bind:open`, `onOpenChange` |
| `SubTrigger` | `role="menuitem"`, `aria-haspopup="menu"`, `aria-expanded`, `data-state` | `disabled`, `textValue`, `openDelay` (pointer rest in ms, default 100) |
| `SubContent` | `div role="menu"`, opening toward the inline end (right in LTR, left in RTL) | `sideOffset` (`2`) |

Every item dispatches a cancelable `menuitemselect` DOM event before `onSelect` runs.

## Keyboard

| Key | On the trigger | In a menu |
| --- | --- | --- |
| Enter, Space, ArrowDown | Open, focus the first item | Enter and Space run the item |
| ArrowUp | Open, focus the last item | Previous item |
| ArrowDown | — | Next item; wraps unless `loop={false}`; disabled items are skipped |
| Home, End | — | First and last item |
| Letters | — | Typeahead: jump to the item whose text (or `textValue`) starts with what is typed; repeating a letter cycles |
| ArrowRight (ArrowLeft in RTL), Enter, Space | — | On a submenu trigger: open it and focus its first item |
| ArrowLeft (ArrowRight in RTL) | — | In a submenu: close it and focus its trigger |
| Escape | — | Close this level (a submenu only) and return focus to its trigger |
| Tab | — | Close the whole menu and return focus to the trigger (a menu is not in the tab order) |

## Pointer

- **Opening.** A click on the trigger opens the menu with focus on the menu itself. A keyboard click opens it on the first item.
- **Hover.** Hovering an item highlights (focuses) it; hovering a disabled item clears the highlight. Leaving the menu clears it too, unless a submenu is open from the focused item.
- **Submenus.** Resting on a submenu trigger opens it after `openDelay`. Leaving the trigger toward the submenu sets a **grace area**: a polygon from the exit point to the submenu's near edge, held for 300 ms. Hovering parent items inside that polygon neither steals the highlight nor closes the submenu (`graceArea` and `pointInPolygon` are exported and unit-tested).
- **Moving on.** When the highlight moves to another item, by pointer or keyboard, an open submenu from a different item closes.
- **Outside presses.** A press outside closes every level without moving focus back. A press in the parent menu closes only the submenu.

## Overlay

Content uses `createOverlayCore` from `@texuli/core/overlay-core` with only the **position** feature. A menu is not modal: it has no focus trap, inert or scroll lock.
- **Layers.** It joins the layer stack, so Escape and outside presses reach only the topmost menu. It shows in the browser top layer (`popover="manual"`), so no portal is needed.
- **Inside a modal.** Opened inside a modal dialog, it stays live through the page's inert registry.

## Behavior (`tests/behavior`)

- **`dropdown-menu`:** 8 rows, passing on Chromium, WebKit and the Pixel 7.
- **`menu`** (this task): 12 rows covering open on the first and last items, Home/End, typeahead, checkbox and radio items, the group name, submenu keyboard, Escape, selection, pointer opening, the grace area and outside presses.
  - It passes **12 of 12** on all three browsers. ArrowUp opens the menu on its last item, and Escape in a submenu closes only that submenu, as the WAI-ARIA pattern asks.
  - Open-to-focus p75 stays within 50 ms (`tests/behavior/harness/limits.ts`).

## Size

`@texuli/primitives/menu`: 16.47 KiB gzip (`pnpm size`, 2026-10-24), within its 20 KiB floating-primitive cap. Most of it is positioning (5.43 KiB), the overlay core (5.08 KiB) and roving focus. The task's 6 KB target is not met, for the same reason the lead's floating-primitive caps give.

## Limits

- **Pointer selection.** Items run on click; press-drag-release across items is not supported.
- **Grace area.** It is a 300 ms polygon. Very slow diagonal moves may close the submenu.
- **RTL.** Direction is read from the trigger's computed `direction` when a submenu opens; changing `dir` while it is open does not move it.

## Motion hooks

The content takes `motionHooks` (enter and exit, the closed part held `inert` while its exit plays); see [prim-dialog](prim-dialog.md#motion-hooks).
