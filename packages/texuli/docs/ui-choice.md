# Checkbox, Radio and Switch

**Package:** `texuli` · **Import:** `texuli/choice`

Styled choice controls on owned primitives (`@texuli/primitives/checkbox`,
`radio-group`, `switch`). Labels, descriptions, sizes, and a card radio layout.

| Export | Role |
| --- | --- |
| `Checkbox` | Binary / indeterminate check with optional label + description |
| `Switch` | On/off control with optional label + description |
| `RadioGroup` | Single-select group (`items` or nested `Radio`) |
| `Radio` | One option (default row or card chrome) |

## Checkbox

```svelte
<script lang="ts">
  import { Checkbox } from 'texuli/choice';
  let agree = $state(false);
</script>

<Checkbox bind:checked={agree} label="I agree" description="Fictional terms only." />
```

- `size`: `sm` | `md`
- `indeterminate` for mixed parent rows
- Space toggles; disabled and invalid states use tokens

## Switch

```svelte
<Switch bind:checked={on} label="Notifications" description="Simulated preference." />
```

Thumb position uses logical `inset-inline-start` (RTL-safe).

## Radio group

```svelte
<script lang="ts">
  import { RadioGroup } from 'texuli/choice';
  let plan = $state('team');
</script>

<RadioGroup
  bind:value={plan}
  name="plan"
  variant="card"
  orientation="horizontal"
  items={[
    { value: 'solo', label: 'Solo', description: 'One workspace' },
    { value: 'team', label: 'Team', description: 'Shared notes' },
  ]}
/>
```

- `variant`: `default` | `card`
- `orientation`: `vertical` | `horizontal`
- Roving focus and arrow keys come from the radio-group primitive

## Styles

`@layer tx.components` in `choice.css`. Expanded hit targets (44px on touch). Forced-colors borders on controls.
