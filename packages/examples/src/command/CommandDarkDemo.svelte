<script lang="ts">
import { Command, type CommandItemData, CommandPalette } from 'texuli/command';

let open = $state(true);

const recent: CommandItemData[] = [
  { id: 'inbox', label: 'Open inbox', group: 'Navigation' },
  { id: 'settings', label: 'Open settings', group: 'Navigation' },
  {
    id: 'task',
    label: 'Create task',
    description: 'Harbor Notes',
    group: 'Actions',
  },
];

function search(query: string): CommandItemData[] {
  const needle = query.toLocaleLowerCase();
  return recent.filter((item) => item.label.toLocaleLowerCase().includes(needle));
}
</script>

<section data-example="ui-command-dark" aria-labelledby="command-dark-title">
  <h2 id="command-dark-title">Command on dark tokens</h2>
  <Command.Trigger label="Search commands…" keys={['⌘', 'K']} onclick={() => (open = true)} />
  <CommandPalette bind:open recentItems={recent} {search} shortcut={false} />
</section>

<style>
  section {
    color: var(--tx-foreground, CanvasText);
    min-block-size: 22rem;
  }
</style>
