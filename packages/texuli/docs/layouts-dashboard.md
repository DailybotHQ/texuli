# Dashboard grid and analytics layouts

**Package:** `texuli`  
**Import:** `texuli/layouts/dashboard`  
**Layout id:** `dashboard-grid`  
**Tests:** `packages/texuli/tests/layouts.test.ts`  
**Example:** `layouts-dashboard`

## Goal

- **Dashboard grid layout** — top chrome (brand, primary nav, actions, user) plus a
  container-query widget grid. Registers as `dashboard-grid` on the layout host
  (min width 768 px, fallback `mobile-drawer`).
- **Analytics grid** — auto-fit KPI / widget grid for screen content (`AnalyticsGrid`).

Both use logical CSS, container queries, RTL via host `dir`, and forced-colors
fallbacks. No third-party class libraries.

## Usage

```svelte
<script lang="ts">
  import { LayoutHost } from 'texuli/layouts/host';
  // Registers dashboard-grid:
  import 'texuli/layouts/dashboard';
  import { AnalyticsGrid } from 'texuli/layouts/dashboard';

  const nav = {
    brand: { label: 'Harbor', href: '#/' },
    sections: [
      {
        id: 'main',
        items: [
          { id: 'home', label: 'Overview', href: '#/' },
          { id: 'revenue', label: 'Revenue', href: '#/revenue' },
        ],
      },
    ],
  };
</script>

<LayoutHost layout="dashboard-grid" {nav} options={{ dense: false, title: 'Overview' }} dir="ltr">
  {#snippet children()}
    <AnalyticsGrid label="Key metrics" columns={3} minItem={220}>
      <article data-span="1">…KPI…</article>
      <article data-span="2">…chart…</article>
    </AnalyticsGrid>
  {/snippet}
</LayoutHost>
```

### Layout options

| Key | Type | Effect |
| --- | --- | --- |
| `dense` | boolean | Tighter header and grid gap |
| `title` | string | Header title when there are no primary nav items |
| `gap` | string | CSS gap for the dashboard grid (default `1rem`) |

### Widget spans

Inside the dashboard grid (or nested content), set `data-span="2|3|4"` on a
child so it spans multiple columns from the 36 rem / 56 rem / 72 rem container
breakpoints.

## Related

- Host contract: `texuli/layouts/host` (`layoutForWidth('dashboard-grid', width)`)
- Chrome: `LayoutChrome` (skip, brand, actions, user)
