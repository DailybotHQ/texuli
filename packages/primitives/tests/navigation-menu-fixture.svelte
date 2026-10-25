<script lang="ts">
import { NavigationMenu } from '../src/navigation-menu/index.ts';

interface Props {
  viewport?: boolean;
  orientation?: 'horizontal' | 'vertical';
  dir?: 'ltr' | 'rtl';
  value?: string;
  delayDuration?: number;
  onValueChange?: (value: string) => void;
  onSelect?: (name: string, event: MouseEvent) => void;
}

let {
  viewport = false,
  orientation = 'horizontal',
  dir,
  value = $bindable(''),
  delayDuration = 200,
  onValueChange,
  onSelect,
}: Props = $props();
</script>

<button type="button">Before</button>
<NavigationMenu.Root aria-label="Main" bind:value {orientation} {dir} {delayDuration} {onValueChange}>
  <NavigationMenu.List>
    <NavigationMenu.Item value="products">
      <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
      <NavigationMenu.Content>
        <NavigationMenu.Link href="/analytics" onSelect={(event) => onSelect?.('analytics', event)}>Analytics</NavigationMenu.Link>
        <NavigationMenu.Link href="/automation">Automation</NavigationMenu.Link>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
    <NavigationMenu.Item value="resources">
      <NavigationMenu.Trigger>
        {#snippet child({ props })}
          <button {...props} class="custom-trigger">Resources</button>
        {/snippet}
      </NavigationMenu.Trigger>
      <NavigationMenu.Content>
        <NavigationMenu.Link href="/docs">Docs</NavigationMenu.Link>
        <NavigationMenu.Link href="javascript:alert(1)">Unsafe</NavigationMenu.Link>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
    <NavigationMenu.Item value="pricing">
      <NavigationMenu.Link href="/pricing" active>Pricing</NavigationMenu.Link>
    </NavigationMenu.Item>
    <NavigationMenu.Indicator data-testid="indicator" />
  </NavigationMenu.List>
  {#if viewport}<NavigationMenu.Viewport data-testid="viewport" />{/if}
</NavigationMenu.Root>
<button type="button">After</button>
