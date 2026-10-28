<script lang="ts">
import { NotificationInbox, setRead } from '@texuli/data/activity/inbox';
import { getPlayerInteraction } from '../context.ts';

/**
 * `data-notification-inbox`: notifications from plain JSON. Read changes stay
 * in view (the blueprint's items are not written back); `filter` is
 * bindable. Links always pass the untrusted URL policy: a blueprint can
 * never widen it.
 */
interface Item {
  id: string;
  title: string;
  body?: string;
  at: string;
  read: boolean;
  href?: string;
}

let {
  items,
  filter = 'all',
  now,
  timeZone = 'UTC',
  locale = 'en-US',
  markReadOnOpen = true,
  headingLevel = 2,
  txPath,
}: {
  items: readonly Item[];
  filter?: 'all' | 'unread';
  now?: string;
  timeZone?: string;
  locale?: string;
  markReadOnOpen?: boolean;
  headingLevel?: number;
  txPath?: string;
} = $props();

const interaction = getPlayerInteraction();
let shown = $state.raw<readonly Item[]>([]);
$effect.pre(() => {
  shown = items;
});
let view = $state<'all' | 'unread'>('all');
$effect.pre(() => {
  view = filter;
});
// Without a valid `now` the labels count from when the node paints.
const clock = $derived(now && !Number.isNaN(Date.parse(now)) ? now : new Date().toISOString());
const level = $derived(
  Math.min(6, Math.max(2, Math.trunc(headingLevel) || 2)) as 2 | 3 | 4 | 5 | 6
);
</script>

<NotificationInbox
  items={shown}
  now={clock}
  {timeZone}
  {locale}
  bind:filter={view}
  {markReadOnOpen}
  hrefTrust="untrusted"
  headingLevel={level}
  onFilterChange={(next) => {
    if (txPath === undefined) return;
    interaction?.write(txPath, 'filter', next);
    interaction?.dispatch(txPath, 'change', { value: next });
  }}
  onReadChange={(ids, read) => {
    shown = setRead(shown, ids, read);
  }}
  onOpen={(item) => {
    if (txPath !== undefined) interaction?.dispatch(txPath, 'select', { value: item.id });
  }}
/>
