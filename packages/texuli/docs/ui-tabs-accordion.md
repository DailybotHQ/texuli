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
    { value: 'search', label: 'Search', icon: 'search' },
  ]}
>
  {#snippet content(item)}
    <p>{item.label} panel</p>
  {/snippet}
</Tabs>
```

- `variant`: `line` | `pills` | `enclosed`
- An item's `icon` (an `IconRef`: a built-in name such as `search`, or a
  Svelte SVG component such as a Lucide icon) renders before the label. It
  is decorative (`aria-hidden`), so the tab's name stays its `label`
- An item's `badge` is part of the tab's accessible name ("Team 3"); set
  `badgeLabel` for words that read better ("3 pending"). The visible badge
  is hidden from assistive technology and a visually hidden copy carries the
  name, so it is announced once
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

## Motion

- **Tabs** (`motion`, `layout` on by default): the active indicator glides
  from the old tab to the new one. A temporary `.tx-tabs__indicator` element
  plays the move under the tab labels while the list carries
  `data-tx-tabs-gliding`, then leaves; nothing changes at rest.
- **Accordion** (`motion`, `layout` on by default): a panel animates its
  height open, and closed before it unmounts.

Both play through `@texuli/core/motion` ([ui-motion](ui-motion.md)) and are
instant under reduced motion, a `MotionProvider` level of `none` or
`motion={false}`. `Collapsible` keeps its CSS transition (planned).
