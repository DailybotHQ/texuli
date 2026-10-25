<script lang="ts">
import { ActivityFeed, type ActivityFilter, type ActivityItem } from '@texuli/data/activity';

const NOW = '2026-02-12T18:00:00.000Z';

const names: Record<string, string> = {
  'p-marta': 'Marta Ruiz',
  'p-li': 'Li Chen',
  'p-sam': 'Sam Ortiz',
  'p-aya': 'Aya Okonkwo',
};

let items = $state<ActivityItem[]>([
  {
    id: '1',
    at: '2026-02-12T16:45:00.000Z',
    actorId: 'p-marta',
    kind: 'comment',
    entity: 'deal',
    recordId: 'deal-7',
    recordLabel: 'Acme renewal',
    lines: [],
    body: 'Looping in @{p-li} — please review #{deal-7} before Friday.',
  },
  {
    id: '2',
    at: '2026-02-12T14:10:00.000Z',
    actorId: 'p-li',
    kind: 'update',
    entity: 'deal',
    recordId: 'deal-7',
    recordLabel: 'Acme renewal',
    lines: ['changed status from Open to Negotiation', 'set close date to 2026-03-01'],
  },
  {
    id: '3',
    at: '2026-02-12T09:05:00.000Z',
    actorId: 'p-sam',
    kind: 'create',
    entity: 'task',
    recordId: 'task-3',
    recordLabel: 'Send security questionnaire',
    lines: ['created'],
  },
  {
    id: '4',
    at: '2026-02-11T17:20:00.000Z',
    actorId: 'p-aya',
    kind: 'comment',
    entity: 'deal',
    recordId: 'deal-7',
    recordLabel: 'Acme renewal',
    lines: [],
    body: 'Customer asked about SSO. Flagging for @{p-marta}.',
  },
  {
    id: '5',
    at: '2026-02-11T11:00:00.000Z',
    actorId: 'p-li',
    kind: 'import',
    entity: 'contact',
    recordId: 'c-22',
    recordLabel: 'Harbor Logistics',
    lines: ['imported'],
  },
  {
    id: '6',
    at: '2026-02-10T15:30:00.000Z',
    actorId: 'p-sam',
    kind: 'delete',
    entity: 'note',
    recordId: 'n-9',
    recordLabel: 'Duplicate note',
    lines: ['deleted'],
  },
  {
    id: '7',
    at: '2026-02-09T08:00:00.000Z',
    actorId: 'p-marta',
    kind: 'restore',
    entity: 'file',
    recordId: 'f-2',
    recordLabel: 'Pricing sheet',
    lines: ['restored'],
  },
]);

let reactions = $state<Record<string, Record<string, string[]>>>({
  1: { '👍': ['p-li', 'p-sam'], '🎉': ['p-aya'] },
  4: { '👀': ['p-marta'] },
});
let filter = $state<ActivityFilter>({});
let direction = $state<'ltr' | 'rtl'>('ltr');
let lastOpen = $state('No item opened yet.');

function onReactionToggle(
  item: ActivityItem,
  _emoji: string,
  next: Record<string, string[]>
): void {
  reactions = { ...reactions, [item.id]: next };
}
</script>

<section data-example="data-activity" aria-labelledby="data-activity-title" dir={direction}>
  <header class="head">
    <div>
      <h2 id="data-activity-title">Activity feed</h2>
      <p>
        Fictional CRM timeline with day groups, avatars, mention tokens, reactions, kind filters
        and load-more pagination. Fixed clock: 12 Feb 2026, 18:00 UTC.
      </p>
    </div>
    <div class="controls" role="group" aria-label="Activity demo controls">
      <button type="button" onclick={() => (direction = direction === 'ltr' ? 'rtl' : 'ltr')}>
        Direction: {direction}
      </button>
    </div>
  </header>

  <ActivityFeed
    {items}
    now={NOW}
    timeZone="UTC"
    dir={direction}
    getActorName={(item) => names[item.actorId] ?? item.actorId}
    personaId="p-marta"
    {reactions}
    {onReactionToggle}
    bind:filter
    filterable
    pageSize={3}
    mentions={{
      person: (id) => names[id],
      record: (id) => (id === 'deal-7' ? 'Acme renewal' : undefined),
    }}
    onOpen={(item) => {
      lastOpen = `Opened ${item.recordLabel ?? item.id}.`;
    }}
    class="demo-activity"
  />

  <p class="meta" role="status">{lastOpen}</p>

  <section class="rtl-fixed" aria-labelledby="data-activity-rtl-title" dir="rtl">
    <h3 id="data-activity-rtl-title">Right-to-left fixed preview</h3>
    <ActivityFeed
      items={items.slice(0, 3)}
      now={NOW}
      timeZone="UTC"
      dir="rtl"
      getActorName={(item) => names[item.actorId] ?? item.actorId}
      personaId="p-li"
      reactions={{ '1': { '👍': ['p-li'] } }}
      pageSize={3}
      class="demo-activity"
    />
  </section>
</section>

<style>
  section[data-example='data-activity'] {
    max-inline-size: 40rem;
    color: var(--tx-text, CanvasText);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-block-end: 1rem;
  }

  .head h2,
  .rtl-fixed h3 {
    margin: 0;
  }

  .head p {
    margin-block: 0.35rem 0;
    max-inline-size: 36rem;
  }

  .controls button {
    min-block-size: 2.5rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.5rem;
    background: var(--tx-surface, Canvas);
    color: inherit;
    cursor: pointer;
  }

  .meta {
    margin-block: 0.75rem 0;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, GrayText);
  }

  .rtl-fixed {
    margin-block-start: 2rem;
  }

  .rtl-fixed h3 {
    margin-block-end: 0.75rem;
  }
</style>
