<script lang="ts">
import { registerAppLayouts } from '../../src/layouts/app/entry.ts';
import SplitView from '../../src/layouts/app/SplitView.svelte';
import type { LayoutId } from '../../src/layouts/host/contract.ts';
import LayoutHost from '../../src/layouts/host/LayoutHost.svelte';
import type { NavModel } from '../../src/layouts/host/nav-model.ts';
import { registerMobileLayouts } from '../../src/layouts/mobile/register.ts';

type Props = {
  layout?: LayoutId;
  dir?: 'ltr' | 'rtl';
  detailActive?: boolean;
  path?: string;
  options?: Record<string, string | number | boolean>;
};

let {
  layout = 'sidebar',
  dir = 'ltr',
  detailActive = false,
  path = '/inbox/mentions',
  options,
}: Props = $props();

registerAppLayouts();
registerMobileLayouts();

const nav: NavModel = {
  brand: { label: 'Harbor Notes', href: '#/' },
  sections: [
    {
      id: 'workspace',
      label: 'Workspace',
      items: [
        {
          id: 'inbox',
          label: 'Inbox',
          href: '#/inbox',
          icon: 'inbox',
          children: [{ id: 'mentions', label: 'Mentions', href: '#/inbox/mentions' }],
        },
        { id: 'notes', label: 'Notes', href: '#/notes', icon: 'file-text' },
      ],
    },
    {
      id: 'team',
      label: 'Team',
      items: [{ id: 'people', label: 'People', href: '#/people', icon: 'users' }],
    },
  ],
};
</script>

<div dir={dir} data-layout-harness>
  {#snippet context()}
    <h2>Context notes</h2>
    <p data-testid="context-copy">Related details stay available.</p>
  {/snippet}
  <LayoutHost {layout} {nav} {path} {dir} {options} aside={context}>
    <p data-testid="screen-copy">Current routed screen.</p>
  </LayoutHost>
  <SplitView listLabel="Threads" detailLabel="Selected thread" {detailActive}>
    {#snippet list()}
      <button type="button">Open thread</button>
    {/snippet}
    {#snippet detail()}
      <p data-testid="split-detail">Thread details</p>
    {/snippet}
    {#snippet empty()}
      <p>No thread selected.</p>
    {/snippet}
  </SplitView>
</div>
