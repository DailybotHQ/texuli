<script lang="ts">
import {
  Breadcrumb,
  NavigationMenu,
  type NavSize,
  Pagination,
  type PaginationVariant,
} from '../../src/components/navigation/index.ts';

let {
  menuOpen = $bindable(''),
  page = $bindable(2),
  size = 'md' as NavSize,
  paginationVariant = 'outline' as PaginationVariant,
}: {
  menuOpen?: string;
  page?: number;
  size?: NavSize;
  paginationVariant?: PaginationVariant;
} = $props();
</script>

<section data-fixture="navigation">
  <Breadcrumb
    {size}
    label="Trail"
    items={[
      { label: 'Home', href: 'https://example.com/' },
      { label: 'Docs', href: 'https://example.com/docs' },
      { label: 'Components' },
    ]}
  />

  <NavigationMenu.Root aria-label="Main" bind:value={menuOpen} {size}>
    <NavigationMenu.List>
      <NavigationMenu.Item value="products">
        <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
        <NavigationMenu.Content>
          <NavigationMenu.Link href="https://example.com/analytics">Analytics</NavigationMenu.Link>
          <NavigationMenu.Link href="https://example.com/automation">Automation</NavigationMenu.Link>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
      <NavigationMenu.Item value="pricing">
        <NavigationMenu.Link href="https://example.com/pricing" active>Pricing</NavigationMenu.Link>
      </NavigationMenu.Item>
    </NavigationMenu.List>
  </NavigationMenu.Root>

  <Pagination.Root
    bind:page
    pageCount={8}
    label="Result pages"
    {size}
    variant={paginationVariant}
  />
</section>
