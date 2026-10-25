<script lang="ts">
import { registerAppLayouts } from 'texuli/layouts/app';
import SplitView from 'texuli/layouts/app/split-view';
import type { NavModel } from 'texuli/layouts/host';
import { LayoutHost } from 'texuli/layouts/host';
import { registerMobileLayouts } from 'texuli/layouts/mobile/register';

type AppLayout = 'sidebar' | 'top-nav' | 'dual-sidebar' | 'rail' | 'master-detail' | 'split-view';
const choices: { id: AppLayout; label: string }[] = [
  { id: 'sidebar', label: 'Sidebar' },
  { id: 'rail', label: 'Icon rail' },
  { id: 'top-nav', label: 'Top navigation' },
  { id: 'dual-sidebar', label: 'Three-pane' },
  { id: 'master-detail', label: 'Master-detail' },
  { id: 'split-view', label: 'List and detail' },
];

registerAppLayouts();
// Below each app layout's minimum width LayoutHost falls back to
// `mobile-drawer` or `mobile-tabs`, which the mobile module owns.
registerMobileLayouts();

let selected = $state<AppLayout>('sidebar');

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
          badge: 4,
          children: [
            { id: 'mentions', label: 'Mentions', href: '#/inbox/mentions' },
            { id: 'assigned', label: 'Assigned', href: '#/inbox/assigned' },
          ],
        },
        { id: 'notes', label: 'Notes', href: '#/notes', icon: 'file-text' },
        { id: 'archive', label: 'Archive', href: '#/archive', icon: 'archive' },
      ],
    },
    {
      id: 'team',
      label: 'Team',
      items: [{ id: 'people', label: 'People', href: '#/people', icon: 'users' }],
    },
  ],
  actions: [{ id: 'help', label: 'Help', icon: 'help', href: 'https://example.com/help' }],
  user: { name: 'Riley Morgan', detail: 'Workspace admin' },
};
</script>

<section class="tx-layouts-demo" data-example="texuli-app-layouts" aria-labelledby="app-layouts-title">
  <h2 id="app-layouts-title">App layouts</h2>
  <p>Six ways to arrange a small fictional workspace as the available width changes.</p>

  <div class="tx-layouts-demo__choices" role="group" aria-label="Choose a layout">
    {#each choices as choice (choice.id)}
      <button
        type="button"
        aria-pressed={selected === choice.id}
        onclick={() => (selected = choice.id)}
      >
        {choice.label}
      </button>
    {/each}
  </div>

  <div class="tx-layouts-demo__frame">
    {#if selected === 'split-view'}
      <SplitView listLabel="Inbox threads" detailLabel="Thread details">
        {#snippet list()}
          <ul class="tx-layouts-demo__threads">
            <li><button type="button" aria-current="true">Release notes</button></li>
            <li><button type="button">Launch checklist</button></li>
            <li><button type="button">Design review</button></li>
          </ul>
        {/snippet}
        {#snippet detail()}
          <div class="tx-layouts-demo__thread-detail">
            <h3>Release notes</h3>
            <p>The split view keeps a selected record beside its list on wide screens.</p>
          </div>
        {/snippet}
        {#snippet empty()}
          <p>Select a thread to see its details.</p>
        {/snippet}
      </SplitView>
    {:else}
      {#snippet context()}
        <h3>Context</h3>
        <p>Related notes stay beside the current screen on wide layouts.</p>
      {/snippet}
      <LayoutHost
        layout={selected}
        {nav}
        path="/inbox/mentions"
        dir={selected === 'dual-sidebar' ? 'rtl' : 'ltr'}
        options={selected === 'rail' ? { expanded: true } : undefined}
        aside={selected === 'dual-sidebar' ? context : undefined}
      >
        <h3>
          {selected === 'dual-sidebar'
            ? 'Current conversation'
            : selected === 'master-detail'
              ? 'Mentions'
              : 'Inbox'}
        </h3>
        <p>
          {selected === 'dual-sidebar'
            ? 'Navigation, screen and context adapt to RTL direction.'
            : selected === 'rail'
              ? 'A compact icon rail expands labels on wide screens.'
              : selected === 'master-detail'
                ? 'List and detail stay side by side when there is room; phones get Back.'
                : 'Messages and tasks for the Harbor team.'}
        </p>
      </LayoutHost>
    {/if}
  </div>
</section>

<style>
  .tx-layouts-demo {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    color: var(--tx-foreground, CanvasText);
  }

  .tx-layouts-demo h2,
  .tx-layouts-demo h3,
  .tx-layouts-demo p {
    margin: 0;
  }

  .tx-layouts-demo > p {
    color: var(--tx-muted-foreground, GrayText);
  }

  .tx-layouts-demo__choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tx-layouts-demo__choices button {
    min-block-size: 2.5rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.375rem);
    padding-inline: 0.75rem;
    background: var(--tx-surface, Canvas);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .tx-layouts-demo__choices button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }

  .tx-layouts-demo__choices button[aria-pressed='true'] {
    border-color: var(--tx-primary, Highlight);
    background: var(--tx-surface, Canvas);
  }

  .tx-layouts-demo__frame {
    /* A framed preview: the app surface is the frame, not the viewport. */
    --tx-app-height: 100%;
    block-size: 30rem;
    min-inline-size: 0;
    overflow: hidden;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background, Canvas);
  }

  .tx-layouts-demo__frame :global([data-tx-layout-host]),
  .tx-layouts-demo__frame :global([data-tx-split-view]) {
    block-size: 100%;
  }

  .tx-layouts-demo__frame h3 {
    font-size: 0.9rem;
  }

  .tx-layouts-demo__frame p {
    margin-block-start: 0.35rem;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.8rem;
  }

  .tx-layouts-demo__threads {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0.5rem;
    list-style: none;
  }

  .tx-layouts-demo__threads button {
    inline-size: 100%;
    min-block-size: 2.5rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.375rem);
    background: var(--tx-surface, Canvas);
    color: inherit;
    font: inherit;
    text-align: start;
  }

  .tx-layouts-demo__thread-detail {
    padding: 1rem;
  }

  @media (forced-colors: active) {
    .tx-layouts-demo__frame,
    .tx-layouts-demo__choices button,
    .tx-layouts-demo__threads button {
      border-color: CanvasText;
    }
  }
</style>
