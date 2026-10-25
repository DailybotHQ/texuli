<script lang="ts">
import { LayoutHost } from 'texuli/layouts/host';
import { registerMobileLayouts } from 'texuli/layouts/mobile/register';
import DemoScreen from './DemoScreen.svelte';
import { HARBOR_NAV } from './nav.ts';

/**
 * Drawer layout at a desktop width, opened on a deal's detail screen: the
 * header shows Back to Deals and the deal's title; the menu button opens the
 * whole navigation in a drawer.
 */
registerMobileLayouts();
let path = $state('/deals/42');

function follow(event: MouseEvent): void {
  const link = (event.target as Element | null)?.closest?.('a[href^="#/"]');
  if (!link) return;
  event.preventDefault();
  path = (link.getAttribute('href') ?? '#/').slice(1) || '/';
}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="frame" data-example="layouts-mobile-drawer" onclick={follow}>
  <LayoutHost
    layout="mobile-drawer"
    nav={HARBOR_NAV}
    {path}
    options={{ title: path === '/deals/42' ? 'Lumen Atlas pilot' : '' }}
  >
    {#snippet children()}
      <DemoScreen {path} />
    {/snippet}
  </LayoutHost>
</div>

<style>
  .frame {
    inline-size: min(100%, 48rem);
    block-size: 24rem;
    overflow: auto;
    border: 1px solid var(--tx-border, currentColor);
    border-radius: var(--tx-radius, 0.5rem);
  }
</style>
