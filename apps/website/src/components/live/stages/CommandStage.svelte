<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * CommandPalette: opens from the trigger (or Ctrl/⌘+K when the shortcut is
 * on), filters as you type, and reports the chosen command.
 */
import { Command, type CommandItemData, CommandPalette } from 'texuli/command';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, bool, pick } = readers(() => values);

const CATALOG: CommandItemData[] = [
  { id: 'open-inbox', label: 'Open inbox', group: 'Navigation', keywords: ['mail'] },
  { id: 'open-settings', label: 'Open settings', group: 'Navigation', keywords: ['preferences'] },
  {
    id: 'create-note',
    label: 'Create note',
    description: 'Add a note to Harbor Notes',
    group: 'Actions',
  },
  { id: 'invite', label: 'Invite member', group: 'Actions' },
];

function search(query: string): CommandItemData[] {
  const needle = query.toLocaleLowerCase();
  return CATALOG.filter(
    (item) =>
      item.label.toLocaleLowerCase().includes(needle) ||
      item.keywords?.some((keyword) => keyword.includes(needle))
  );
}

let open = $state(false);
let chosen = $state('');
</script>

<div class="stage" data-tx-command-stage={componentId}>
  <Command.Trigger label="Search commands…" keys={['⌘', 'K']} onclick={() => (open = true)} />
  <CommandPalette
    bind:open
    recentItems={CATALOG.slice(0, 2)}
    {search}
    shortcut={bool('shortcut', false)}
    title={str('title', 'Command palette')}
    placeholder={str('placeholder', 'Search…')}
    emptyLabel={str('emptyLabel', 'No matching commands')}
    size={pick('size', ['sm', 'md', 'lg'] as const, 'md')}
    variant={pick('variant', ['outline', 'soft'] as const, 'outline')}
    onSelect={(item: CommandItemData) => {
      chosen = item.label;
    }}
  />
  <p class="state" role="status">{chosen ? `Ran “${chosen}”` : 'No command run yet'}</p>
</div>

<style>
  .stage {
    display: grid;
    gap: 0.6rem;
    justify-items: start;
  }
  .state {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
