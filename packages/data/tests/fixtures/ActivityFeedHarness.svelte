<script lang="ts">
import { ActivityFeed, type ActivityFilter, type ActivityItem } from '../../src/activity/index.ts';

const NOW = '2026-02-12T18:00:00.000Z';

let items = $state<ActivityItem[]>([
  {
    id: 'a1',
    at: '2026-02-12T16:30:00.000Z',
    actorId: 'p-marta',
    kind: 'comment',
    entity: 'deal',
    recordId: 'deal-1',
    recordLabel: 'Acme renewal',
    lines: [],
    body: 'Thanks @{p-li} — see #{deal-1}.',
  },
  {
    id: 'a2',
    at: '2026-02-12T12:00:00.000Z',
    actorId: 'p-li',
    kind: 'update',
    entity: 'deal',
    recordId: 'deal-1',
    recordLabel: 'Acme renewal',
    lines: ['changed status from Open to Won', 'set owner to Marta'],
  },
  {
    id: 'a3',
    at: '2026-02-11T09:15:00.000Z',
    actorId: 'p-marta',
    kind: 'create',
    entity: 'deal',
    recordId: 'deal-1',
    recordLabel: 'Acme renewal',
    lines: ['created'],
  },
  {
    id: 'a4',
    at: '2026-02-10T14:00:00.000Z',
    actorId: 'p-sam',
    kind: 'import',
    entity: 'contact',
    recordId: 'c-9',
    recordLabel: 'Harbor Logistics',
    lines: ['imported'],
  },
  {
    id: 'a5',
    at: '2026-02-09T11:00:00.000Z',
    actorId: 'p-li',
    kind: 'delete',
    entity: 'note',
    recordId: 'n-3',
    recordLabel: 'Stale note',
    lines: ['deleted'],
  },
]);

const names: Record<string, string> = {
  'p-marta': 'Marta Ruiz',
  'p-li': 'Li Chen',
  'p-sam': 'Sam Ortiz',
};

let filter = $state<ActivityFilter>({});
let reactions = $state<Record<string, Record<string, string[]>>>({
  a1: { '👍': ['p-li'] },
});
let personaId = $state('p-marta');
let opens = $state<string[]>([]);
let pageSize = 2;

function onReactionToggle(
  item: ActivityItem,
  _emoji: string,
  next: Record<string, string[]>
): void {
  reactions = { ...reactions, [item.id]: next };
}

function onOpen(item: ActivityItem): void {
  opens = [...opens, item.id];
}
</script>

<ActivityFeed
  {items}
  now={NOW}
  timeZone="UTC"
  locale="en-US"
  getActorName={(item) => names[item.actorId] ?? item.actorId}
  {personaId}
  {reactions}
  {onReactionToggle}
  bind:filter
  filterable
  {pageSize}
  mentions={{
    person: (id) => names[id],
    record: (id) => (id === 'deal-1' ? 'Acme renewal' : undefined),
  }}
  {onOpen}
/>
<output aria-label="Open count">{opens.length}</output>
<output aria-label="Reaction thumbs">{(reactions.a1?.['👍'] ?? []).join(',')}</output>
<output aria-label="Filter kinds">{(filter.kinds ?? []).join(',')}</output>
