# DropdownMenu, ContextMenu and Menubar

**Package:** `texuli`  
**Import:** `import { DropdownMenu, ContextMenu, Menubar } from 'texuli/menus'`  
**Tests:** `packages/texuli/tests/menus.test.ts`  
**Example:** `texuli-menus`

## Contract

Styled menus on owned primitives (`@texuli/primitives/menu`, `context-menu`, `menubar`):

| Namespace | Trigger | Role |
| --- | --- | --- |
| `DropdownMenu` | Button | Menu button pattern |
| `ContextMenu` | Region (right-click / long-press / Menu key) | Contextual menu |
| `Menubar` | Top-level bar | Application menubar |

Shared chrome: items with optional `icon` snippet and `shortcut` string (rendered as `Kbd`), checkbox/radio indicators, submenu chevron, separators and group labels.

### Item props (shared)

| Prop | Role |
| --- | --- |
| `icon` | Leading icon snippet |
| `shortcut` | Keyboard hint (display only; host still wires the shortcut) |
| `inset` | Extra start padding when no icon |
| `disabled`, `onSelect`, `textValue`, `closeOnSelect` | From the primitive |

### Variants / sizes

`variant`: `default` \| `soft` · `size`: `sm` \| `md` \| `lg` on content and triggers.

## Usage

```svelte
<script lang="ts">
  import { ContextMenu, DropdownMenu, Menubar } from 'texuli/menus';
  let open = $state(true);
  let grid = $state(true);
</script>

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.Item shortcut="⌘N">New</DropdownMenu.Item>
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger>Share</DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        <DropdownMenu.Item>Copy link</DropdownMenu.Item>
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
    <DropdownMenu.Separator />
    <DropdownMenu.CheckboxItem bind:checked={grid}>Show grid</DropdownMenu.CheckboxItem>
  </DropdownMenu.Content>
</DropdownMenu.Root>

<ContextMenu.Root>
  <ContextMenu.Trigger>Right-click this region</ContextMenu.Trigger>
  <ContextMenu.Content>
    <ContextMenu.Item>Cut</ContextMenu.Item>
    <ContextMenu.Item>Copy</ContextMenu.Item>
  </ContextMenu.Content>
</ContextMenu.Root>

<Menubar.Root aria-label="Application">
  <Menubar.Menu value="file">
    <Menubar.Trigger>File</Menubar.Trigger>
    <Menubar.Content>
      <Menubar.Item>New</Menubar.Item>
    </Menubar.Content>
  </Menubar.Menu>
</Menubar.Root>
```

Styles live in `@layer tx.components`. Logical properties; forced-colors borders. Shortcuts are visual only — register real keybindings in the host.
