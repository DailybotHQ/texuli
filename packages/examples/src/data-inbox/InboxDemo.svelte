<script lang="ts">
import { type InboxNotification, NotificationInbox, setRead } from '@texuli/data/activity/inbox';

// Fictional data only; a fixed clock keeps the time labels stable.
const now = '2026-10-28T12:00:00Z';
let items = $state<InboxNotification[]>([
  {
    id: 'n1',
    title: 'Ada Park mentioned you in Harbor Notes renewal',
    body: '“Can you confirm the seat count before Friday?”',
    at: '2026-10-28T10:42:00Z',
    read: false,
    href: '#deal-harbor',
  },
  {
    id: 'n2',
    title: 'Your export is ready',
    body: 'Deals, October 2026 (CSV)',
    at: '2026-10-28T08:05:00Z',
    read: false,
    href: 'https://app.example.com/exports/7',
  },
  {
    id: 'n3',
    title: 'Bea Ruiz assigned Lumen Atlas pilot to you',
    at: '2026-10-27T16:30:00Z',
    read: true,
  },
  {
    id: 'n4',
    title: 'Weekly pipeline digest',
    body: '5 deals moved, 2 closed.',
    at: '2026-10-21T09:00:00Z',
    read: true,
  },
]);
let archived = $state<string[]>([]);
let arrivals = 0;
const visible = $derived(items.filter((item) => !archived.includes(item.id)));

function simulate(): void {
  arrivals += 1;
  items = [
    {
      id: `new-${arrivals}`,
      title: `Cy Moreau commented on Café Ñandú rollout (${arrivals})`,
      at: '2026-10-28T11:58:00Z',
      read: false,
    },
    ...items,
  ];
}
</script>

<section class="demo" data-example="data-inbox" aria-labelledby="data-inbox-title">
  <h2 id="data-inbox-title">Workspace notifications</h2>
  <button type="button" class="demo-button" onclick={simulate}>Simulate a new notification</button>
  <NotificationInbox
    items={visible}
    {now}
    headingLevel={3}
    onReadChange={(ids, read) => (items = setRead(items, ids, read))}
  >
    {#snippet actions(item)}
      <button
        type="button"
        class="demo-button"
        aria-label={`Archive: ${item.title}`}
        onclick={() => (archived = [...archived, item.id])}>Archive</button
      >
    {/snippet}
  </NotificationInbox>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 44rem;
    padding: 1.5rem;
  }
  .demo h2 {
    margin: 0;
  }
  .demo-button {
    justify-self: start;
    min-block-size: 2.25rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, ButtonFace);
    color: var(--tx-surface-foreground, ButtonText);
    font: inherit;
  }
</style>
