# Components: Toggle and ToggleGroup

**Package:** `texuli`  
**Import:** `import { Toggle, ToggleGroup, ToggleGroupItem } from 'texuli/toggle'`  
**Task:** T-ui-toggle

Styled pressable toggles and segmented controls on the token contract.
Wraps `@texuli/primitives/toggle`. Logical CSS. No static `style=`.

## API

```svelte
<script lang="ts">
  import { Toggle, ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
  let on = $state(false);
  let align = $state('left');
</script>

<Toggle bind:pressed={on} variant="outline" size="sm" aria-label="Bold">B</Toggle>

<ToggleGroup type="single" bind:value={align} variant="outline" aria-label="Align">
  <ToggleGroupItem value="left">Left</ToggleGroupItem>
  <ToggleGroupItem value="center">Center</ToggleGroupItem>
  <ToggleGroupItem value="right">Right</ToggleGroupItem>
</ToggleGroup>
```

| Export | Role |
| --- | --- |
| `Toggle` | Single pressable button (`aria-pressed`) |
| `ToggleGroup` | Single or multiple selection shell |
| `ToggleGroupItem` | Item inside a group |

### Variants / sizes

- `variant`: `default` \| `outline`
- `size`: `sm` \| `md` \| `lg`
- Group `orientation`: `horizontal` \| `vertical`

## Example

Registry id **`texuli-toggle`**.

## Testing

```bash
pnpm vitest run packages/texuli/tests/toggle.test.ts
TEXULI_E2E_PORT=4930 pnpm visual:update -g texuli-toggle
```
