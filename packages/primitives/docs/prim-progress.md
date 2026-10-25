# Progress

**Package:** `@texuli/primitives` · **Import:** `@texuli/primitives/progress` or `@texuli/primitives`

Headless, owned Svelte 5 progressbar. Determinate and indeterminate values with live updates. Built on Texuli internals, composed as `Progress.Root`.

## API

```svelte
<script lang="ts">
  import { Progress } from '@texuli/primitives/progress';
  let value = $state<number | null>(40);
</script>

<span id="upload-label">Upload</span>
<Progress.Root {value} max={100} min={0} aria-labelledby="upload-label" />
```

| Prop | Default | Notes |
| --- | --- | --- |
| `value` | `0` | `number` or `null` (indeterminate: no `aria-valuenow`) |
| `max` | `100` | Range maximum (`aria-valuemax`) |
| `min` | `0` | Range minimum (`aria-valuemin`) |
| `child` | — | Snippet receives `{ props }` for composition |
| `ref` | — | Bindable `HTMLDivElement` |
| `children` | — | Default slot inside the root |

## Accessibility (APG)

- Root is `role="progressbar"`.
- Name via `aria-label` or `aria-labelledby` (host responsibility).
- Determinate: `aria-valuemin` / `aria-valuemax` / `aria-valuenow` (clamped into range).
- Indeterminate (`value={null}`): `aria-valuenow` is omitted.
- `data-state`: `loading` | `complete` | `indeterminate`.

## Size

Lazy subpath `@texuli/primitives/progress`: 1.12 KiB gzip (`pnpm size`, 2026-10-24), within the 1.5 KiB task target. Measure with `pnpm size --filter @texuli/primitives/progress`.
