# Layout width utilities

**Package:** `texuli` · **Import:** `import { LAYOUT_WIDTH_UTILITIES } from 'texuli'`
(side-imports `layout-widths.css`) · **Status:** built for blueprint spec `0.13.0`

Pane and column **inline-size** stay rem (or `--tx-layout-*` max widths). `--tx-space-*`
and Tailwind spacing that read `--tx-space-unit` multiply `--tx-density`; these widths
do not, so a sidebar stays 20rem when density is compact or spacious.

| Class | Width |
| --- | --- |
| `tx-w-content` | `max-inline-size: var(--tx-layout-content-max)` (72ch) |
| `tx-w-wide` | `max-inline-size: var(--tx-layout-wide-max)` (80rem) |
| `tx-w-full` | `inline-size: var(--tx-layout-full-max)` (100%) |
| `tx-w-pane` | `inline-size: 20rem` (sidebar / rail) |
| `tx-w-column` | `inline-size: 16rem` (secondary column) |

`tx-w-pane` and `tx-w-column` also set `max-inline-size: 100%` so they shrink in a
narrow container. Gutters and padding still use `--tx-space-*` and scale with density.

```svelte
<script lang="ts">
  import { LAYOUT_WIDTH_UTILITIES } from 'texuli';
  const pane = LAYOUT_WIDTH_UTILITIES[3]; // 'tx-w-pane'
</script>

<aside class="tx-w-pane">…</aside>
```

Styles live in `@layer tx.components`. Tests:
`packages/texuli/tests/protoyard-round3.test.ts`.
