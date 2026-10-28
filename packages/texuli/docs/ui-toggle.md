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

### Forms, attributes and focus

- `name` (and `form`, for a group outside its form) makes the group a form
  field: it submits one `name=value` entry per pressed item, so a
  `type="multiple"` group submits every pressed value. A disabled group
  submits nothing.
- Extra attributes (`id`, `aria-describedby`, `data-*`, handlers) land on the
  group element, and `bind:ref` binds it.
- The Tab stop starts on the first pressed item, for `single` and `multiple`
  groups alike (no pressed item: the first enabled one).

```svelte
<form>
  <ToggleGroup type="multiple" name="days" bind:value={days} aria-label="Days">
    <ToggleGroupItem value="mon">Mon</ToggleGroupItem>
    <ToggleGroupItem value="tue">Tue</ToggleGroupItem>
  </ToggleGroup>
</form>
```

### Variants / sizes

- `variant`: `default` \| `outline`
- `size`: `sm` \| `md` \| `lg`
- Group `orientation`: `horizontal` \| `vertical`

## Example

Registry id **`texuli-toggle`**.

## Testing

```bash
pnpm vitest run packages/texuli/tests/forms.test.ts
TEXULI_E2E_PORT=4930 pnpm visual:update -g texuli-toggle
```
