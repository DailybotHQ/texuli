# Filter bar

**Package:** `@texuli/data`  
**Subpath:** `@texuli/data/filter-bar` (also `FilterBar` from `@texuli/data`)  
**View:** `packages/data/src/filter-bar/FilterBar.svelte`  
**Example:** `data-dashboard-metrics`

> **Status: in development.** Added in PLAN_023; not yet in a published release.

A compact toolbar for a dashboard or grid: every applied condition is a
removable chip, **Add filter** opens the full [`FilterBuilder`](data-filter-builder.md)
for nested rules, **Clear filters** empties the model, and a status shows
whether the filters are saved. The model is the same `FilterGroup` a
`DataGrid` and `applyFilter` take.

```svelte
<script lang="ts">
import { FilterBar } from '@texuli/data/filter-bar';
import { applyFilter } from '@texuli/data/filter-builder';

let filter = $state({ type: 'group', op: 'and', children: [] });
</script>

<FilterBar {fields} bind:value={filter} saved={false} />
```

## Props

| Prop | Default | What it does |
| --- | --- | --- |
| `fields` | required | The fields a condition can test. |
| `value` | empty `and` group | The model (`bind:value`). |
| `onValueChange` | — | Called on every edit: a chip removed, clear, or a change in the builder. |
| `saved` | `true` | Shows `savedLabel` or `unsavedLabel` in a polite status. |
| `disabled` | `false` | Disables every control. |
| `label`, `addLabel`, `clearLabel`, `savedLabel`, `unsavedLabel` | English | Visible and accessible labels. |
| `class` | — | Extra classes. |

## Accessibility

The bar is a labeled region; chips sit in a labeled group, and each remove
button names its condition. The builder opens in a native disclosure, so it
works from the keyboard without script focus management.
