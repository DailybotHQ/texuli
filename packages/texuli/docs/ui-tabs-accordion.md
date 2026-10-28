# Tabs, Accordion and Collapsible

**Package:** `texuli` · **Import:** `texuli/tabs-accordion`

Styled disclosure surfaces on owned primitives (`@texuli/primitives/tabs`,
`accordion`, `collapsible`).

| Export | Role |
| --- | --- |
| `Tabs` | Line, pills or enclosed tab lists with optional badges and panels |
| `Accordion` | Single or multiple expandable sections with chevrons |
| `Collapsible` | One disclosure trigger + content |

## Tabs

```svelte
<script lang="ts">
  import { Tabs } from 'texuli/tabs-accordion';
  let tab = $state('profile');
</script>

<Tabs
  bind:value={tab}
  label="Account"
  variant="pills"
  items={[
    { value: 'profile', label: 'Profile' },
    { value: 'team', label: 'Team', badge: 3 },
  ]}
>
  {#snippet content(item)}
    <p>{item.label} panel</p>
  {/snippet}
</Tabs>
```

- `variant`: `line` | `pills` | `enclosed`
- `orientation`: `horizontal` | `vertical`
- Roving focus and activation come from the tabs primitive
- `bind:ref` binds the root element; extra attributes (`id`, `aria-*`,
  `data-*`, handlers) land on it. `Accordion` and `Collapsible` do the same.

## Accordion

```svelte
<Accordion
  type="single"
  items={[
    { value: 'ship', title: 'Shipping', content: 'Two fictional days.' },
    { value: 'return', title: 'Returns', content: '30-day window.' },
  ]}
/>
```

- `type`: `single` | `multiple`
- `variant`: `default` | `bordered`
- `headingLevel`: 2–6 (APG heading around each trigger)

## Collapsible

```svelte
<Collapsible label="More details">
  <p>Expanded copy for Harbor Notes (fictional).</p>
</Collapsible>
```

## Styles

`@layer tx.components` in `tabs-accordion.css`. Logical properties. Forced-colors borders on lists and accordion chrome.
