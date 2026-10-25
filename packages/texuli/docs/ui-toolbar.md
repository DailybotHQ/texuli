# Component: Toolbar

**Import:** `import { Toolbar, ToolbarButton, ToolbarGroup, ToolbarGroupItem, ToolbarLink, ToolbarSeparator } from 'texuli/toolbar'`  
**Task:** T-ui-toolbar

Styled toolbar shell on the token contract. Wraps `@texuli/primitives/toolbar`
(roving tabindex, groups, URL-safe links). Logical CSS. No static `style=`.

## Usage

```svelte
<script lang="ts">
  import {
    Toolbar,
    ToolbarButton,
    ToolbarGroup,
    ToolbarGroupItem,
    ToolbarLink,
    ToolbarSeparator,
  } from 'texuli/toolbar';
</script>

<Toolbar variant="outline" aria-label="Editor">
  <ToolbarButton aria-label="Undo">Undo</ToolbarButton>
  <ToolbarSeparator />
  <ToolbarGroup type="single" bind:value={align} aria-label="Align">
    <ToolbarGroupItem value="left" aria-label="Left">Left</ToolbarGroupItem>
    <ToolbarGroupItem value="right" aria-label="Right">Right</ToolbarGroupItem>
  </ToolbarGroup>
  <ToolbarLink href="https://example.com/help" aria-label="Help">Help</ToolbarLink>
</Toolbar>
```

## Parts

| Export | Role |
| --- | --- |
| `Toolbar` | `role="toolbar"`, roving focus |
| `ToolbarButton` | Focusable action (disabled stays focusable via `aria-disabled`) |
| `ToolbarLink` | Link with URL policy |
| `ToolbarGroup` / `ToolbarGroupItem` | Single (radio) or multiple (toggle) |
| `ToolbarSeparator` | Decorative separator |

### Variants

- `variant`: `default` \| `outline` \| `ghost`
- `size`: `sm` \| `md`
- `orientation`: `horizontal` \| `vertical`

## Example

Registry id **`texuli-toolbar`**.

## Testing

```bash
pnpm vitest run packages/texuli/tests/toolbar.test.ts
TEXULI_E2E_PORT=4930 pnpm visual:update -g texuli-toolbar
```
