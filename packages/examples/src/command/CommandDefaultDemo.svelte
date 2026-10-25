<script lang="ts">
import { Command, type CommandItemData, CommandPalette } from 'texuli/command';

let open = $state(true);

const catalog: CommandItemData[] = [
  { id: 'open-inbox', label: 'Open inbox', group: 'Navigation', keywords: ['mail'] },
  { id: 'open-settings', label: 'Open settings', group: 'Navigation', keywords: ['preferences'] },
  {
    id: 'create-task',
    label: 'Create task',
    description: 'Add a task in Harbor Notes',
    group: 'Actions',
  },
  { id: 'invite-member', label: 'Invite member', group: 'Actions' },
];

const recent = catalog.slice(0, 2);

function search(query: string): CommandItemData[] {
  const needle = query.toLocaleLowerCase();
  return catalog.filter(
    (item) =>
      item.label.toLocaleLowerCase().includes(needle) ||
      item.description?.toLocaleLowerCase().includes(needle) ||
      item.keywords?.some((keyword) => keyword.toLocaleLowerCase().includes(needle))
  );
}
</script>

<section data-example="ui-command" aria-labelledby="command-default-title">
  <h2 id="command-default-title">Command palette</h2>
  <p class="hint">Palette opens with recent items. ⌘/Ctrl+K toggles it.</p>
  <Command.Trigger label="Search commands…" keys={['⌘', 'K']} onclick={() => (open = true)} />
  <CommandPalette
    bind:open
    recentItems={recent}
    {search}
    onSelect={() => {
      /* demo only */
    }}
  />
</section>

<style>
  .hint {
    color: var(--tx-muted-foreground, GrayText);
    font-size: var(--tx-font-size-sm, 0.875rem);
  }
  section {
    color: var(--tx-foreground, CanvasText);
    min-block-size: 24rem;
  }
</style>
