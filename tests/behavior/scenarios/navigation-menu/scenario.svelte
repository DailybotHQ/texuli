<script lang="ts">
// NavigationMenu scenario: @texuli/primitives.
import { NavigationMenu } from '@texuli/primitives/navigation-menu';
import { behaviorEvent } from '../../harness/client/events.ts';

let value = $state('');
</script>

<NavigationMenu.Root aria-label="Main" bind:value onValueChange={(next) => behaviorEvent('valueChange', next)} class="behavior-nav">
  <NavigationMenu.List class="behavior-nav-list">
    <NavigationMenu.Item value="products">
      <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
      <NavigationMenu.Content class="behavior-nav-content">
        <NavigationMenu.Link href="#analytics" onSelect={() => behaviorEvent('select', 'analytics')}>Analytics</NavigationMenu.Link>
        <NavigationMenu.Link href="#automation">Automation</NavigationMenu.Link>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
    <NavigationMenu.Item value="resources">
      <NavigationMenu.Trigger>Resources</NavigationMenu.Trigger>
      <NavigationMenu.Content class="behavior-nav-content">
        <NavigationMenu.Link href="#docs">Docs</NavigationMenu.Link>
        <NavigationMenu.Link href="javascript:alert(1)">Status</NavigationMenu.Link>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
    <NavigationMenu.Item value="pricing">
      <NavigationMenu.Link href="#pricing" active>Pricing</NavigationMenu.Link>
    </NavigationMenu.Item>
    <NavigationMenu.Indicator class="behavior-nav-indicator" />
  </NavigationMenu.List>
  <NavigationMenu.Viewport class="behavior-nav-viewport" />
</NavigationMenu.Root>

<style>
  :global(.behavior-nav) {
    position: relative;
  }
  :global(.behavior-nav-list) {
    display: flex;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  :global(.behavior-nav-content) {
    display: grid;
    gap: 0.25rem;
    padding: 0.5rem;
    border: 1px solid CanvasText;
    background: Canvas;
    color: CanvasText;
  }
</style>
