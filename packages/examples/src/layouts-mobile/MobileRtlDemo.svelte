<script lang="ts">
import { LayoutHost } from 'texuli/layouts/host';
import { registerMobileLayouts } from 'texuli/layouts/mobile/register';
import DemoScreen from './DemoScreen.svelte';
import { HARBOR_NAV } from './nav.ts';

/** Right to left: the tab bar, Back and its chevron mirror; text stays English (fictional). */
registerMobileLayouts();
let path = $state('/deals/43');

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
<div class="frame" dir="rtl" data-example="layouts-mobile-rtl" onclick={follow}>
  <LayoutHost layout="mobile-tabs" dir="rtl" nav={HARBOR_NAV} {path} options={{ title: 'Deal' }}>
    {#snippet children()}
      <DemoScreen {path} />
    {/snippet}
  </LayoutHost>
</div>

<style>
  .frame {
    inline-size: min(100%, 24rem);
    block-size: 30rem;
    overflow: auto;
    border: 1px solid var(--tx-border, currentColor);
    border-radius: 1.25rem;
  }
</style>
