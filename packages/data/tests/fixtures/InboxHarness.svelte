<script lang="ts">
import {
  type InboxNotification,
  NotificationInbox,
  setRead,
} from '../../src/activity/inbox/index.ts';

interface Note extends InboxNotification {
  kind: string;
}

let { hrefTrust }: { hrefTrust?: 'developer' | 'untrusted' } = $props();

let items = $state<Note[]>([
  {
    id: 'n1',
    title: 'Ada mentioned you',
    body: 'On Harbor renewal',
    at: '2026-10-28T09:00:00Z',
    read: false,
    href: '/deals/d1',
    kind: 'mention',
  },
  {
    id: 'n2',
    title: 'Export ready',
    at: '2026-10-27T15:30:00Z',
    read: false,
    href: 'https://app.example.com/exports/7',
    kind: 'export',
  },
  { id: 'n3', title: 'Weekly digest', at: '2026-10-20T08:00:00Z', read: true, kind: 'digest' },
]);
let filter = $state<'all' | 'unread'>('all');
const archived = $state<string[]>([]);
const opened = $state<string[]>([]);

export function push(note: Note): void {
  items = [note, ...items];
}
</script>

<NotificationInbox
  {items}
  now="2026-10-28T12:00:00Z"
  bind:filter
  {...hrefTrust ? { hrefTrust } : {}}
  onReadChange={(ids, read) => (items = setRead(items, ids, read))}
  onOpen={(item) => opened.push(item.id)}
>
  {#snippet actions(item)}
    <button type="button" onclick={() => archived.push(item.id)}>Archive {item.title}</button>
  {/snippet}
</NotificationInbox>
<button type="button" onclick={() => push({ id: `n${items.length + 1}`, title: 'New comment', at: '2026-10-28T11:59:00Z', read: false, kind: 'comment' })}>Simulate arrival</button>
<output data-testid="state">{JSON.stringify({ filter, archived, opened, read: items.map((item) => item.read) })}</output>
