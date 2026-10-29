<script lang="ts">
import { NavigationMenu } from '../../src/navigation-menu/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs, variant = 'inline' }: HarnessProps = $props();
</script>

<NavigationMenu.Root value="docs" {...p('navigation-menu/Root')} bind:ref={refs['navigation-menu/Root']}>
  <NavigationMenu.List {...p('navigation-menu/List')} bind:ref={refs['navigation-menu/List']}>
    <NavigationMenu.Item value="docs" {...p('navigation-menu/Item')} bind:ref={refs['navigation-menu/Item']}>
      <NavigationMenu.Trigger {...p('navigation-menu/Trigger')} bind:ref={refs['navigation-menu/Trigger']}>Docs</NavigationMenu.Trigger>
      <NavigationMenu.Content {...p('navigation-menu/Content')} bind:ref={refs['navigation-menu/Content']}>
        <NavigationMenu.Link href="https://example.com/guide">Guide</NavigationMenu.Link>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
    <NavigationMenu.Item value="blog">
      <NavigationMenu.Link href="https://example.com/blog" {...p('navigation-menu/Link')} bind:ref={refs['navigation-menu/Link']}>Blog</NavigationMenu.Link>
    </NavigationMenu.Item>
    <NavigationMenu.Indicator {...p('navigation-menu/Indicator')} bind:ref={refs['navigation-menu/Indicator']} />
  </NavigationMenu.List>
  {#if variant === 'viewport'}
    <NavigationMenu.Viewport {...p('navigation-menu/Viewport')} bind:ref={refs['navigation-menu/Viewport']} />
  {/if}
</NavigationMenu.Root>
