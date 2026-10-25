<script lang="ts">
import { LayoutHost } from 'texuli/layouts/host';
import { registerMobileLayouts } from 'texuli/layouts/mobile/register';
import DemoScreen from './DemoScreen.svelte';
import { HARBOR_NAV } from './nav.ts';

/**
 * Tab bar layout in a phone-sized frame. The app owns its path (in-memory
 * here, so the demo never changes the page URL): links inside the frame
 * update it, and the layout shows Back on a deal's detail screen.
 */
registerMobileLayouts();
let path = $state('/');

// Links in the More sheet render outside the frame (a portal), so follow hash changes too.
$effect(() => {
  const onhash = () => {
    if (location.hash.startsWith('#/')) path = location.hash.slice(1) || '/';
  };
  window.addEventListener('hashchange', onhash);
  return () => window.removeEventListener('hashchange', onhash);
});

function follow(event: MouseEvent): void {
  const link = (event.target as Element | null)?.closest?.('a[href^="#/"]');
  if (!link) return;
  event.preventDefault();
  path = (link.getAttribute('href') ?? '#/').slice(1) || '/';
}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="frame" data-example="layouts-mobile-tabs" onclick={follow}>
  <LayoutHost
    layout="mobile-tabs"
    nav={HARBOR_NAV}
    {path}
    options={{ title: path.startsWith('/deals/4') ? 'Deal' : '' }}
  >
    {#snippet children()}
      <DemoScreen {path} />
    {/snippet}
  </LayoutHost>
</div>

<style>
  .frame {
    inline-size: min(100%, 24rem);
    block-size: 36rem;
    overflow: auto;
    border: 1px solid var(--tx-border, currentColor);
    border-radius: 1.25rem;
  }
</style>
