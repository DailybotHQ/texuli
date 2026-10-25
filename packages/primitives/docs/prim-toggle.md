# Toggle and ToggleGroup

**Package:** `@texuli/primitives`  
**Source:** `packages/primitives/src/toggle/`  
**Tests:** `packages/primitives/tests/toggle.test.ts`  
**Behavior:** `tests/behavior/scenarios/toggle.spec.ts`

Headless Svelte 5 toggle button and toggle group, owned,
aligned with the WAI-ARIA Authoring Practices toggle button pattern.

## Toggle

```svelte
<script lang="ts">
  import { Toggle } from '@texuli/primitives/toggle';
  let pressed = $state(false);
</script>

<Toggle.Root bind:pressed aria-label="Bold">B</Toggle.Root>
```

| Prop | Role |
| --- | --- |
| `pressed` / `defaultPressed` | Controlled or uncontrolled pressed state |
| `onPressedChange` | Fires when the user toggles |
| `disabled` | Blocks interaction |
| `child` | Composition snippet receiving root attrs |

Root attributes: `role="button"`, `aria-pressed`, `data-state="on"|"off"`,
`data-disabled` when disabled. Space and Enter toggle.

## ToggleGroup

```svelte
<script lang="ts">
  import { ToggleGroup } from '@texuli/primitives/toggle';
  let value = $state('left');
</script>

<ToggleGroup.Root type="single" bind:value aria-label="Align">
  <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
  <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
  <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
</ToggleGroup.Root>
```

| Prop | Role |
| --- | --- |
| `type` | `single` (default) or `multiple` |
| `value` / `defaultValue` | `string` or `string[]` |
| `orientation` | `horizontal` \| `vertical` (roving keys) |
| `rovingFocus` | Arrow-key focus (default true) |
| `loop` | Wrap at ends (default true) |

Single mode: activating the pressed item clears the selection. Multiple mode
adds/removes values. Items mark `data-roving-item` for the attachment.

## Budget

Target ≤ 3 KB gzip for the toggle entry graph (measure when packing).
