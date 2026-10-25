# Component: Slider

**Import:** `import { Slider } from 'texuli/slider'`  
**Task:** T-ui-slider

Styled single and range sliders on the token contract. Wraps
`@texuli/primitives/slider`. Logical CSS. No static `style=`.

## Usage

```svelte
<script lang="ts">
  import { Slider } from 'texuli/slider';
  let volume = $state(40);
  let price = $state([200, 800]);
</script>

<Slider bind:value={volume} label="Volume" showValue step={5} thumbLabel="Volume" />

<Slider
  type="multiple"
  bind:value={price}
  min={0}
  max={1000}
  label="Price"
  showValue
  thumbLabel={['Minimum price', 'Maximum price']}
/>
```

## Props

| Prop | Notes |
| --- | --- |
| `type` | `single` (default) or `multiple` |
| `value` | `number` or `number[]` |
| `min` / `max` / `step` | Scale |
| `orientation` | `horizontal` \| `vertical` |
| `size` | `sm` \| `md` \| `lg` |
| `showTicks` | Tick per step (≤ 100 steps) |
| `marks` | `{ value, label? }[]` labeled marks |
| `label` / `showValue` | Field chrome |
| `thumbLabel` | string or string[] for thumb names |
| `disabled` / `dir` / `name` | Disabled, RTL, form |

## Example

Registry id **`texuli-slider`**.

## Testing

```bash
pnpm vitest run packages/texuli/tests/slider.test.ts
TEXULI_E2E_PORT=4930 pnpm visual:update -g texuli-slider
```
