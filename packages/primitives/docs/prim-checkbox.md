# Primitive: Checkbox

**Package:** `@texuli/primitives`  
**Import:** `import { Checkbox } from '@texuli/primitives/checkbox'`  
**Task:** T-prim-checkbox

Headless Svelte 5 checkbox built on texels (`createControllableState`).

## API

```svelte
<script lang="ts">
  import { Checkbox } from '@texuli/primitives/checkbox';
  let checked = $state(false);
  let indeterminate = $state(false);
</script>

<Checkbox.Root id="updates" name="updates" value="yes" bind:checked bind:indeterminate>
  {#snippet children({ checked, indeterminate })}
    <span aria-hidden="true">{indeterminate ? '–' : checked ? '✓' : ''}</span>
  {/snippet}
</Checkbox.Root>
<label for="updates">Email updates</label>
```

| Part | Role |
| --- | --- |
| `Checkbox.Root` | `role="checkbox"`, `data-state`, Space toggle, form bridge |
| `Checkbox.Group` | Multi-value group context |
| `Checkbox.Indicator` | Optional visual slot |

### States

- `data-state`: `checked` \| `unchecked` \| `indeterminate` \| `disabled`
- `aria-checked`: `true` \| `false` \| `mixed`
- Click / Space toggles; from mixed → checked
- Native `type="checkbox"` form bridge (unchecked omitted from FormData)

## Testing

```bash
pnpm vitest run packages/primitives/tests/forms.test.ts
pnpm exec playwright test tests/behavior/scenarios/checkbox.spec.ts
```

## Budget

Target ≤ 3 KB gzip for the checkbox entry. `@texuli/primitives/checkbox`
measures 2.65 KiB (`pnpm size`, 2026-10-24), within it and the 4 KiB default.
