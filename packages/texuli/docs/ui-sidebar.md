# Sidebar and AppNav

**Package:** `texuli`  
**Import:** `import { Sidebar, AppNav } from 'texuli/sidebar'`  
**Tests:** `packages/texuli/tests/sidebar.test.ts`  
**Example:** `texuli-sidebar`

## Contract

App chrome on `--tx-sidebar*` tokens:

| Component | Role |
| --- | --- |
| `Sidebar` | Collapsible rail with sections, badges, collapse toggle |
| `AppNav` | Desktop sidebar + header menu + mobile `Sheet` drawer + main |

### Sidebar props

| Prop | Role |
| --- | --- |
| `items` / `sections` | Flat list or grouped `{ label?, items }[]` |
| `collapsed` | Bindable icons-only mode |
| `collapsible` | Show collapse control (default true; off in drawers) |
| `drawer` | Full-width host for mobile sheet |
| `variant` | `default` \| `inset` |
| `header` / `footer` | Snippets receiving `{ collapsed }` |
| `itemIcon` | Optional leading icon snippet `(item, collapsed)` |
| `hrefTrust` | URL policy tier for item links (default `developer`) |

Items: `{ id?, label, href?, active?, badge?, disabled?, shortLabel? }`.  
`href` goes through `safeHref`. Active items use `aria-current="page"`. Collapsed badges become a primary dot + screen-reader text; item labels use tooltips.

### AppNav

- Desktop: sidebar column + header + main
- ≤48rem: sidebar hides; menu button opens a left `Sheet` with a non-collapsible `Sidebar`
- Bind `mobileOpen` / `collapsed` as needed

## Usage

```svelte
<script lang="ts">
  import { AppNav, Sidebar } from 'texuli/sidebar';
  const sections = [
    {
      label: 'Workspace',
      items: [
        { label: 'Inbox', href: 'https://example.com/inbox', active: true, badge: 3 },
        { label: 'Notes', href: 'https://example.com/notes' },
      ],
    },
  ];
  let collapsed = $state(false);
</script>

<AppNav {sections} bind:collapsed>
  {#snippet header({ collapsed })}
    <strong>{collapsed ? 'HN' : 'Harbor Notes'}</strong>
  {/snippet}
  <p>Main content</p>
</AppNav>
```

Or use `Sidebar` alone inside a custom shell. Styles live in `@layer tx.components`. Logical properties; forced-colors borders.
