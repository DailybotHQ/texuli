<script lang="ts">
/**
 * Fixed 1280×800 frame with short main content to assert sidebar block stretch.
 */
import { registerAppLayouts } from '../../src/layouts/app/entry.ts';
import type { LayoutId } from '../../src/layouts/host/contract.ts';
import LayoutHost from '../../src/layouts/host/LayoutHost.svelte';
import type { NavModel } from '../../src/layouts/host/nav-model.ts';

let {
  layout = 'sidebar' as LayoutId,
}: {
  layout?: LayoutId;
} = $props();

registerAppLayouts();

const nav: NavModel = {
  brand: { label: 'Harbor', href: '#/' },
  sections: [
    {
      id: 'main',
      items: [
        { id: 'home', label: 'Home', href: '#/', icon: 'home' },
        { id: 'inbox', label: 'Inbox', href: '#/inbox', icon: 'inbox' },
      ],
    },
  ],
};
</script>

<div
  class="height-frame"
  data-sidebar-height-frame
  style="width: 1280px; height: 800px; overflow: hidden; position: relative;"
>
  <LayoutHost {layout} {nav} path="/">
    <p data-testid="short-copy">Short content only.</p>
  </LayoutHost>
</div>

<style>
  .height-frame {
    /* Give the host a definite viewport like a desktop shell. */
    --tx-app-height: 800px;
  }
  .height-frame :global([data-tx-layout-host]) {
    block-size: 100%;
    min-block-size: 100%;
  }
</style>
