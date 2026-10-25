<script lang="ts">
import { Breadcrumb, NavigationMenu, Pagination } from 'texuli/navigation';
</script>

<section data-example="ui-navigation-states" class="demo" aria-label="Navigation states">
  <h2>States</h2>
  <Breadcrumb
    label="Collapsed trail"
    maxItems={3}
    items={[
      { label: 'Home', href: 'https://example.com/' },
      { label: 'Org', href: 'https://example.com/org' },
      { label: 'Team', href: 'https://example.com/team' },
      { label: 'Project', href: 'https://example.com/project' },
      { label: 'Settings' },
    ]}
  />
  <NavigationMenu.Root aria-label="Closed menu" value="">
    <NavigationMenu.List>
      <NavigationMenu.Item value="a">
        <NavigationMenu.Trigger>Closed</NavigationMenu.Trigger>
        <NavigationMenu.Content>
          <NavigationMenu.Link href="https://example.com/a">Link A</NavigationMenu.Link>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
      <NavigationMenu.Item>
        <NavigationMenu.Link href="javascript:alert(1)">Blocked href</NavigationMenu.Link>
      </NavigationMenu.Item>
    </NavigationMenu.List>
  </NavigationMenu.Root>
  <Pagination.Root page={1} pageCount={4} disabled label="Disabled pages" />
</section>

<style>
  .demo {
    display: grid;
    gap: 1.25rem;
    justify-items: start;
    padding: 1.5rem;
    min-block-size: 14rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
  }
</style>
