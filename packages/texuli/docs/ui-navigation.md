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

Compose with `Pagination.Page` / `PreviousButton` / `NextButton` / `Ellipsis` when you need a custom list.

## Rules

- Logical CSS; `@layer tx.components`
- No HTML sinks; every `href` goes through the URL policy
- Translatable labels via primitive props (`previousLabel`, `nextLabel`, breadcrumb `label`)
