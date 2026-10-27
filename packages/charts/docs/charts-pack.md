# Charts: circle packing

**Package:** `@texuli/charts`

**Import:** `import { PackChart } from '@texuli/charts/pack'`

`PackChart` renders a `PackTree` with circle area proportional to each leaf's
value. Its geometry comes from the public `pack` math. Node ids must be unique;
leaf values must be finite and non-negative; an optional parent value must equal
the sum of its children. The component requires a non-empty `title` and
`description` and includes every hierarchy level in its data table.

## Props

### `PackChart` (`charts-pack`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `root` | tree node `{ id, label?, value?, children? }` | yes | — | blueprint | Recursive hierarchy rooted at this node. |
| `labels` | { table, category, value } | no | labels object | blueprint | Localized labels for the accessible data table and chart text. |
| `width` | number (> 0) | no | `640` | blueprint | View-box width in pixels. |
| `height` | number (> 0) | no | `420` | blueprint | View-box height in pixels. |
| `padding` | number (≥ 0) | no | `2` | blueprint | Gap between packed circles in pixels. |

## Tiers

Every prop above is `blueprint` (editable from JSON blueprints, catalog nodes
and chart blocks) unless marked `developer`. See
[prop schemas and tiers](charts-schemas.md).

## Keyboard

The data table sits in a native `details` disclosure: Tab reaches its summary
and Enter or Space opens and closes it. There is no point-by-point keyboard
explorer in this family.

## Example

Registry example id: **`charts-pack`**.

```bash
pnpm vitest run packages/charts/tests/part-whole.test.ts
TEXULI_E2E_PORT=4932 pnpm visual -g charts-pack
```
