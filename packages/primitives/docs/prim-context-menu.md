# ContextMenu

**Package:** `@texuli/primitives` · **Import:** `@texuli/primitives/context-menu`

A headless menu that opens at the pointer: a right click, Ctrl+click, a
touch or pen long press, or the keyboard (the Menu key or Shift+F10). It
shares the [Menu](prim-menu.md) machinery: items, checkbox and radio items,
groups, separators, submenus, typeahead, the pointer grace area and
dismissal. Only the trigger, the root and where the content is anchored
differ. It follows the WAI-ARIA APG **menu** pattern, and its parts are
composed as `ContextMenu.*`.

## Usage

```svelte
<script lang="ts">
  import { ContextMenu } from '@texuli/primitives/context-menu';
</script>

<ContextMenu.Root>
  <ContextMenu.Trigger>
    <Canvas />
  </ContextMenu.Trigger>
  <ContextMenu.Content>
    <ContextMenu.Item onSelect={cut}>Cut</ContextMenu.Item>
    <ContextMenu.Item onSelect={copy}>Copy</ContextMenu.Item>
    <ContextMenu.Separator />
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger>Share</ContextMenu.SubTrigger>
      <ContextMenu.SubContent>
        <ContextMenu.Item onSelect={copyLink}>Copy link</ContextMenu.Item>
      </ContextMenu.SubContent>
    </ContextMenu.Sub>
  </ContextMenu.Content>
</ContextMenu.Root>
```

Put `Content` next to the `Trigger`, not inside it.

## Parts

- **`ContextMenu.Root`**: `open` (bindable), `onOpenChange`, `loop` (default
  `true`), the same props as `Menu.Root`.
- **`ContextMenu.Trigger`** is the region that opens the menu: a `<div>` (any
  attribute), or your element through a `child` snippet (`{ props }`).
  - `disabled`: the browser's own context menu shows instead.
  - It renders `data-state="open" | "closed"`, `data-disabled` and
    `data-context-menu-trigger`.
  - It sets `-webkit-touch-callout: none`, so iOS shows no callout on a long
    press. Set `user-select: none` yourself if text in the region should not
    be selected by a long press.
  - The region's text names the menu (`aria-labelledby`).
- **`ContextMenu.Content`**: `side` (default `right`), `align` (default
  `start`), `sideOffset` (default `2`) and any `<div>` attribute.
  - The menu's corner sits at the pointer, and it flips and shifts to stay in
    view.
  - The point is kept relative to the trigger region, so the menu follows the
    region when the page scrolls.
- **Shared with Menu:** `Item`, `CheckboxItem`, `RadioGroup`, `RadioItem`,
  `Group`, `GroupHeading`, `Separator`, `Sub`, `SubTrigger`, `SubContent` and
  `Portal` are Menu's parts. See [prim-menu.md](prim-menu.md) for their props.

## Opening and closing

| Input | Effect |
| --- | --- |
| Right click, Ctrl+click | Opens at the pointer instead of the browser menu; focus goes to the menu (ArrowDown or ArrowUp then enters on the first or last item) |
| Right click again in the region | Moves the open menu to the new point |
| Long press (touch or pen, 600 ms, within 10 px) | Opens at the finger. Lifting the finger is not a click, and a browser `contextmenu` for the same press does not open it twice |
| A press that moves more than 10 px (a scroll), or lifts early | Nothing |
| Menu key or Shift+F10 on a focused element in the region | Opens under that element, on the first item |
| Arrows, Home, End, typeahead, Enter, Space, submenus | As in Menu |
| Escape | Closes; focus returns to the element that had it before the menu opened |
| Selecting an item | Runs it and closes; focus returns the same way |
| Tab | Closes |
| A left click on the region, or a press outside | Closes |

`LONG_PRESS_MS` (600) and `LONG_PRESS_SLOP` (10) are exported.

**Keyboard opening is the browser's.** The Menu key and Shift+F10 reach the
page as the native `contextmenu` event, which the trigger handles. Headless
WebKit in the tests sends no such event, so the WebKit browser test dispatches
it the way a browser does; Chromium's is a real key press.

## Shared change to Menu

When focus is on a menu itself, not on an item, ArrowDown now enters on the
first enabled item and ArrowUp on the last. That happens after a pointer
opens a menu, or after the pointer leaves it. Before, ArrowDown skipped to the
second item. This is in `menu/ContentImpl.svelte` and applies to Menu,
DropdownMenu and ContextMenu.

## Size

`@texuli/primitives/context-menu` is **17,586 B gzip** (15,471 B brotli,
`pnpm exec tsx scripts/size.ts --filter @texuli/primitives/context-menu`,
2026-10-24). That is **718 B on top of** `@texuli/primitives/menu` (16,868 B),
within the task's ≤ 2 KB and the `@texuli/primitives/context-menu` budget of
22,528 B.

## Tests

```bash
pnpm vitest run packages/primitives/tests/context-menu.test.ts
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/context-menu.spec.ts
```

**Unit** (8 tests) cover:
- the right click (default prevented, focus on the menu, ArrowDown and
  ArrowUp entry);
- the keyboard open and focus return;
- the shared Menu keys, submenu, checkbox item and select-closes;
- moving the menu on a second right click, and closing on a region press;
- outside press, Escape and Tab;
- `disabled`;
- the touch long press (the lift is not a click, no double open);
- cancelled long presses.

**Browser** covers:
- Chromium and WebKit: the right click at the pointer, moving, closing,
  keyboard opening with focus return, the pointer on items, checkboxes and
  submenus, and axe in light and dark with the menu open;
- the Pixel 7: a real CDP touch long press and tap, and axe.
