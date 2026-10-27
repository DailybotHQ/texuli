# Primitive: Select

**Package:** `@texuli/primitives`  
**Import:** `import { Select } from '@texuli/primitives/select'`  
**Task:** T-prim-select

Headless single-select listbox. Built on `@texuli/core/overlay` (positioning +
outside/Escape dismiss only — no focus trap, inert, or scroll lock) and
`@texuli/core/roving` typeahead.

## API

```svelte
<script lang="ts">
  import { Select } from '@texuli/primitives/select';
  let value = $state('free');
</script>

<span id="plan-label">Plan</span>
<Select.Root type="single" bind:value name="plan" items={items} onValueChange={...}>
  <Select.Trigger aria-labelledby="plan-label">{label}</Select.Trigger>
  <Select.Portal>
    <Select.Content>
      <Select.Viewport>
        {#each items as item}
          <Select.Item value={item.value} label={item.label} disabled={item.disabled}>
            {item.label}
          </Select.Item>
        {/each}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
```

| Part | Role |
| --- | --- |
| `Root` | value, open, name, items, form bridge |
| `Trigger` | `role="combobox"`, opens list |
| `Content` | `role="listbox"`, floating overlay |
| `Item` | `role="option"`, `aria-disabled` when disabled |
| `Portal` / `Viewport` / `Value` | composition shells |
| `Group` | `role="group"` with `aria-labelledby` |
| `GroupLabel` (`GroupHeading`) | labels the group for AT |

## Groups

```svelte
<Select.Content>
  <Select.Group>
    <Select.GroupLabel>Personal</Select.GroupLabel>
    <Select.Item value="free" label="Free">Free</Select.Item>
  </Select.Group>
  <Select.Group>
    <Select.GroupLabel>Organization</Select.GroupLabel>
    <Select.Item value="team" label="Team">Team</Select.Item>
  </Select.Group>
</Select.Content>
```

Arrow keys and typeahead walk the flat option list across groups and skip
disabled items.

## Behavior

- Open: click, Enter, Space, ArrowDown/Up on the trigger
- Navigate: arrows, Home/End, typeahead letters
- Choose: Enter/Space or click (disabled options stay inert)
- Escape: close and restore focus to the trigger
- Form: hidden native field via `createFormBridge`

## Testing

```bash
pnpm vitest run packages/primitives/tests/forms.test.ts
TEXULI_E2E_PORT=4930 pnpm exec playwright test tests/behavior/scenarios/select.spec.ts --project=chromium
pnpm size --filter primitives/select
```
