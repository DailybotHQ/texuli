<script lang="ts">
import type { BottomNavItem } from '../../src/layouts/mobile/index.ts';
import { BottomNav, MobileAppFrame, MobileHeader } from '../../src/layouts/mobile/index.ts';

let {
  items,
  onBack,
  backHref,
  nested = false,
}: {
  items: BottomNavItem[];
  onBack?: (event: MouseEvent) => void;
  backHref?: string;
  nested?: boolean;
} = $props();
</script>

{#snippet frame()}
  <MobileAppFrame mainId="screen">
    {#snippet header()}
      <MobileHeader title="Deal 42" subtitle="Orbit Labs" {backHref} {onBack} backTarget="Deals">
        {#snippet actions()}<button type="button">Edit</button>{/snippet}
      </MobileHeader>
    {/snippet}
    {#snippet stickyFooter()}<button type="button">Save</button>{/snippet}
    {#snippet bottomNav()}<BottomNav {items} label="Tabs" />{/snippet}
    <p>Screen content</p>
  </MobileAppFrame>
{/snippet}

{#if nested}
  <main>{@render frame()}</main>
{:else}
  {@render frame()}
{/if}
