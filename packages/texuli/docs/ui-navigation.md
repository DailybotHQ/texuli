# NavigationMenu, Breadcrumb and Pagination

**Package:** `texuli`  
**Source:** `packages/texuli/src/components/navigation/`  
**Primitives:** `@texuli/primitives/navigation-menu`, `@texuli/primitives/pagination`  
**Tests:** `packages/texuli/tests/navigation.test.ts`  
**Examples:** `ui-navigation`, `ui-navigation-variants`, `ui-navigation-states`, `ui-navigation-rtl`, `ui-navigation-dark`

Styled site navigation on the `--tx-*` token contract.

## NavigationMenu

```svelte
<script lang="ts">
  import { NavigationMenu } from 'texuli/navigation';
  let value = $state('');
</script>

<NavigationMenu.Root aria-label="Main" bind:value>
  <NavigationMenu.List>
    <NavigationMenu.Item value="products">
      <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
      <NavigationMenu.Content>
        <NavigationMenu.Link href="https://example.com/a">Analytics</NavigationMenu.Link>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
    <NavigationMenu.Item>
      <NavigationMenu.Link href="https://example.com/p" active>Pricing</NavigationMenu.Link>
    </NavigationMenu.Item>
    <NavigationMenu.Indicator />
  </NavigationMenu.List>
  <NavigationMenu.Viewport />
</NavigationMenu.Root>
```

Links use `safeHref` (default developer trust). Unsafe hrefs render without `href`.

## Breadcrumb

```svelte
<script lang="ts">
  import { Breadcrumb } from 'texuli/navigation';
</script>

<Breadcrumb
  label="Trail"
  items={[
    { label: 'Home', href: 'https://example.com/' },
    { label: 'Docs', href: 'https://example.com/docs' },
    { label: 'Select' },
  ]}
/>
```

| Prop | Role |
| --- | --- |
| `items` | `{ label, href?, current? }[]` |
| `maxItems` | Collapse middle crumbs into an ellipsis |
| `hrefTrust` | URL policy tier for links |

## Pagination

```svelte
<script lang="ts">
  import { Pagination } from 'texuli/navigation';
  let page = $state(1);
</script>

<Pagination.Root bind:page pageCount={12} label="Result pages" variant="outline" />
```

| Prop | Values |
| --- | --- |
| `variant` | `outline` (default), `soft` |
| `size` | `sm`, `md`, `lg` |
| `stableCount` | `false`. When `true`, the control keeps the same number of tokens (pages and ellipses) on every page and sizes each page button for the widest page number, so nothing shifts under the pointer |
| `siblings`, `boundaries` | `1`, `1`: pages beside the current one and at each end |

Compose with `Pagination.Page` / `PreviousButton` / `NextButton` / `Ellipsis` when you need a custom list.

- **Stable count.** `getStablePageTokens(page, pageCount, siblings?, boundaries?)`
  returns exactly `stablePageSlots(siblings, boundaries)` tokens
  (`2 × boundaries + 2 × siblings + 3`, 7 by default) once the page count
  exceeds that: near either end the page run widens to fill the slot an
  ellipsis would leave. Custom `children` of a `stableCount` root receive
  these `pages`. The default list sets `--tx-pagination-digits` (the widest
  number's digit count) and page buttons (`data-tx-pagination-page`) take
  that width; set the variable yourself on a custom list. Page numbers use
  tabular figures in every mode.
- **`Pagination.Ellipsis`** forwards attributes and handlers (`id`,
  `title`, `data-*`, `onclick`…) to its wrapper; `class` styles the mark.
  The mark stays hidden from assistive tech.

## Rules

- Logical CSS; `@layer tx.components`
- No HTML sinks; every `href` goes through the URL policy
- Translatable labels via primitive props (`previousLabel`, `nextLabel`, breadcrumb `label`)
