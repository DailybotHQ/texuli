# Toggle and ToggleGroup

**Package:** `@texuli/primitives`  
**Source:** `packages/primitives/src/toggle/`  
**Tests:** `packages/primitives/tests/composites.test.ts`  
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

Controlled state comes in two forms. `bind:pressed` alone: the toggle writes
the new value back. `pressed={value}` with `onPressedChange`: the handler owns
the state; the toggle reports the change and keeps rendering the `pressed` it
is given, so a handler that ignores the change keeps `aria-pressed` as it was
(UG-27, 0.14.2). With both `bind:pressed` and `onPressedChange`, set the value
in the handler, or use a function binding
(`bind:pressed={() => on, (next) => { on = next; save(next); }}`).
`ToggleGroup` follows the same rule for `value` and `onValueChange`.
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
| `name` / `form` | Form field: one hidden `name=value` input per pressed item (none while disabled) |
| `deselectable` | `single` only (default `true`): `false` keeps the pressed item pressed when it is activated again |

Single mode: activating the pressed item clears the selection (unless
`deselectable` is `false`). Multiple mode
adds/removes values. Items mark `data-roving-item` for the attachment. The
Tab stop starts on the first pressed item in both modes (no pressed item: the
first enabled one).

## Budget

Target ≤ 3 KB gzip for the toggle entry graph (measure when packing).
