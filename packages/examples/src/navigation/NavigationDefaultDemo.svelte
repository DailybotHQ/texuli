<script lang="ts">
import { Breadcrumb, NavigationMenu, Pagination } from 'texuli/navigation';

let menu = $state('products');
let page = $state(2);
</script>

<section data-example="ui-navigation" class="demo" aria-label="Navigation default">
  <h2>Site navigation</h2>
  <p>Breadcrumb trail, disclosure navigation menu and pagination on the token contract.</p>

  <Breadcrumb
    label="Trail"
    items={[
      { label: 'Home', href: 'https://example.com/' },
      { label: 'Library', href: 'https://example.com/library' },
      { label: 'Components' },
    ]}
  />

  <NavigationMenu.Root aria-label="Main" bind:value={menu}>
    <NavigationMenu.List>
      <NavigationMenu.Item value="products">
        <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
        <NavigationMenu.Content>
          <NavigationMenu.Link href="https://example.com/analytics">Analytics</NavigationMenu.Link>
          <NavigationMenu.Link href="https://example.com/automation">Automation</NavigationMenu.Link>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
      <NavigationMenu.Item value="docs">
        <NavigationMenu.Trigger>Docs</NavigationMenu.Trigger>
        <NavigationMenu.Content>
          <NavigationMenu.Link href="https://example.com/guides">Guides</NavigationMenu.Link>
          <NavigationMenu.Link href="https://example.com/api">API</NavigationMenu.Link>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
      <NavigationMenu.Item value="pricing">
        <NavigationMenu.Link href="https://example.com/pricing" active>Pricing</NavigationMenu.Link>
      </NavigationMenu.Item>
      <NavigationMenu.Indicator />
    </NavigationMenu.List>
  </NavigationMenu.Root>

  <Pagination.Root bind:page pageCount={12} label="Catalog pages" />
</section>

<style>
  .demo {
    display: grid;
    gap: 1.25rem;
    justify-items: start;
    padding: 1.5rem;
    min-block-size: 18rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  p {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    max-inline-size: 40rem;
  }
</style>
