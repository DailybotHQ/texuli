# Select

**Package:** `texuli`  
**Source:** `packages/texuli/src/components/select/`  
**Primitive:** `@texuli/primitives/select`  
**Tests:** `packages/texuli/tests/select.test.ts`  
**Examples:** `ui-select`, `ui-select-variants`, `ui-select-states`, `ui-select-rtl`, `ui-select-dark`

Styled single-select listbox on the `--tx-*` token contract: field-like trigger,
floating content, groups, optional descriptions and leading icons.

## Usage

```svelte
<script lang="ts">
  import { Select } from 'texuli/select';
  const items = [
    { value: 'free', label: 'Free' },
    { value: 'team', label: 'Team' },
  ];
  let value = $state('free');
</script>

<span id="plan-label">Plan</span>
<Select.Root bind:value {items} name="plan">
  <Select.Trigger aria-labelledby="plan-label">
    <Select.Value placeholder="Choose a plan" />
  </Select.Trigger>
  <Select.Portal>
    <Select.Content>
      <Select.Viewport>
        <Select.Group>
          <Select.Label>Plans</Select.Label>
          {#each items as item}
            <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
          {/each}
        </Select.Group>
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
```

## Parts

| Part | Role |
| --- | --- |
| `Root` | `value`, `open`, `items`, `name`, `size`, `variant` |
| `Trigger` | Combobox button with chevron |
| `Value` | Selected label or placeholder |
| `Content` | Floating listbox surface |
| `Item` | Option; optional `description`, `icon` |
| `Group` / `Label` / `Separator` | Grouping chrome |

`Select.Label` names its group, so it must be rendered inside a
`Select.Group`; rendered anywhere else it throws
(`Select.GroupLabel must be rendered inside Select.Group`). To label the
whole control, name the trigger instead (`aria-labelledby` pointing at
visible text, as in the example above, or `aria-label`).

## Variants

| Prop | Values |
| --- | --- |
| `variant` | `outline` (default), `soft` |
| `size` | `sm`, `md`, `lg` |

## Rules

- Logical CSS only; `@layer tx.components`
- No HTML sinks; option text is plain
- Form participation via the primitive `name` + form bridge
- Links inside custom item content must use the URL policy

`Select.Separator` is decorative (`aria-hidden`): a listbox may own only
options and groups, so it is not an `<hr>` separator.
