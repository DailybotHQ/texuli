<script lang="ts">
import { Breadcrumb, NavigationMenu, Pagination } from 'texuli/navigation';
</script>

<section data-example="ui-navigation-dark" class="demo" aria-label="Navigation dark">
  <h2>Dark surface</h2>
  <Breadcrumb
    label="Trail"
    items={[
      { label: 'Workspace', href: 'https://example.com/ws' },
      { label: 'Settings' },
    ]}
  />
  <NavigationMenu.Root aria-label="Main" value="account">
    <NavigationMenu.List>
      <NavigationMenu.Item value="account">
        <NavigationMenu.Trigger>Account</NavigationMenu.Trigger>
        <NavigationMenu.Content>
          <NavigationMenu.Link href="https://example.com/profile">Profile</NavigationMenu.Link>
          <NavigationMenu.Link href="https://example.com/billing">Billing</NavigationMenu.Link>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
      <NavigationMenu.Item>
        <NavigationMenu.Link href="https://example.com/help">Help</NavigationMenu.Link>
      </NavigationMenu.Item>
    </NavigationMenu.List>
  </NavigationMenu.Root>
  <Pagination.Root page={4} pageCount={9} variant="soft" label="Dark pages" />
</section>

<style>
  .demo {
    display: grid;
    gap: 1.25rem;
    justify-items: start;
    padding: 1.5rem;
    min-block-size: 16rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
  }
</style>
