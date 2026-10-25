<script lang="ts">
import { NavigationMenu } from '../../../src/navigation-menu/index.ts';
</script>

<NavigationMenu.Root aria-label="Main" value="products">
  <NavigationMenu.List>
    <NavigationMenu.Item value="products">
      <NavigationMenu.Trigger id="products-trigger">Products</NavigationMenu.Trigger>
      <NavigationMenu.Content id="products-panel">
        <NavigationMenu.Link href="#analytics">Analytics</NavigationMenu.Link>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
  </NavigationMenu.List>
</NavigationMenu.Root>
