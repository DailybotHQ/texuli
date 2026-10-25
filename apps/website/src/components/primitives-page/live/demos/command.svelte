<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md', 'lg'], default: 'md' },
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['outline', 'soft'],
      default: 'outline',
    },
    { kind: 'boolean', name: 'loop', label: 'loop', default: true },
    { kind: 'string', name: 'placeholder', label: 'Placeholder', default: 'Type a command' },
  ],
  keys: [
    { keys: ['ArrowDown', 'ArrowUp'], action: 'Highlight the next or previous command' },
    { keys: ['Home', 'End'], action: 'With Ctrl or Cmd: the first or last command' },
    { keys: ['Enter'], action: 'Run the highlighted command' },
  ],
  uncontrolled:
    'The palette filters and ranks its own items as you type, and reports the chosen one.',
  controlled:
    'shouldFilter={false} with onSearch: your code owns the query (bind:value) and the result list.',
  code: (v) => `<script lang="ts">
  import { Command } from '@texuli/primitives/command';
  let last = $state('');
${SCRIPT_END}

<Command.Root label="Commands"${attr('loop', v.loop !== false, true)} onSelect={(value) => (last = value)}>
  <Command.Input placeholder="${v.placeholder}" />
  <Command.List>
    <Command.Empty>No commands match.</Command.Empty>
    <Command.Group value="Navigation">
      <Command.GroupHeading>Navigation</Command.GroupHeading>
      <Command.GroupItems>
        <Command.Item value="inbox" label="Open inbox" />
        <Command.Item value="settings" label="Open settings" />
      </Command.GroupItems>
    </Command.Group>
  </Command.List>
</Command.Root>

${recipeLine('commandRootClass', 'texuli/command', { size: v.size ?? 'md', variant: v.variant ?? 'outline' })}`,
  keyCheck: {
    focus: '[data-demo-part="Command.Input"]',
    press: 'ArrowDown',
    expect: { selector: '[data-demo-item="settings"]', attribute: 'aria-selected', value: 'true' },
  },
  controlCheck: {
    act: '[data-demo-act="add"]',
    expect: { selector: '[data-demo-item="archive"]', count: 1 },
  },
};
</script>

<script lang="ts">
import { Command } from '@texuli/primitives/command';
import { Button } from 'texuli/button';
import {
  type CommandSize,
  type CommandVariant,
  commandEmptyClass,
  commandGroupClass,
  commandGroupHeadingClass,
  commandInputClass,
  commandInputRowClass,
  commandItemClass,
  commandListClass,
  commandLoadingClass,
  commandRootClass,
} from 'texuli/command';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

type Entry = { value: string; label: string; group: string; keywords?: readonly string[] };

const GROUPS = ['Navigation', 'Actions'];
const BASE: readonly Entry[] = [
  { value: 'inbox', label: 'Open inbox', group: 'Navigation' },
  { value: 'settings', label: 'Open settings', group: 'Navigation', keywords: ['preferences'] },
  { value: 'task', label: 'Create task', group: 'Actions', keywords: ['new', 'todo'] },
  { value: 'invite', label: 'Invite a teammate', group: 'Actions', keywords: ['people'] },
];

const size = $derived<CommandSize>(
  (['sm', 'md', 'lg'] as const).find((option) => option === str(values, 'size')) ?? 'md'
);
const variant = $derived<CommandVariant>(str(values, 'variant') === 'soft' ? 'soft' : 'outline');
const loop = $derived(bool(values, 'loop', true));
const placeholder = $derived(str(values, 'placeholder'));

let last = $state('none');
let entries = $state<Entry[]>([...BASE]);
let query = $state('');
const results = $derived(
  query.trim()
    ? entries.filter((entry) => entry.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    : entries
);

/** Host-driven search: a short, fictional wait shows the Loading part. */
function search(): Promise<void> {
  return new Promise((done) => setTimeout(done, 250));
}

function addArchive(): void {
  if (!entries.some((entry) => entry.value === 'archive')) {
    entries = [...entries, { value: 'archive', label: 'Archive project', group: 'Actions' }];
  }
}
</script>

{#snippet palette(list: readonly Entry[])}
  <div class={commandInputRowClass()} data-tx-command-input-row="">
    <svg class="tx-command__search-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="m10.5 10.5 3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    {#if mode === 'controlled'}
      <Command.Input bind:value={query} {placeholder} class={commandInputClass()} data-tx-command-input="" data-demo-part="Command.Input" />
    {:else}
      <Command.Input {placeholder} class={commandInputClass()} data-tx-command-input="" data-demo-part="Command.Input" />
    {/if}
  </div>
  <Command.List class={commandListClass()} data-tx-command-list="" data-demo-part="Command.List">
    <Command.Loading class={commandLoadingClass()} data-tx-command-loading="" data-demo-part="Command.Loading">Searching…</Command.Loading>
    <Command.Empty class={commandEmptyClass()} data-tx-command-empty="" data-demo-part="Command.Empty">No commands match.</Command.Empty>
    {#each GROUPS as group (group)}
      <Command.Group value={group} class={commandGroupClass()} data-tx-command-group="" data-demo-part="Command.Group">
        <Command.GroupHeading class={commandGroupHeadingClass()} data-tx-command-group-heading="" data-demo-part="Command.GroupHeading">{group}</Command.GroupHeading>
        <!-- GroupItems renders no element of its own. -->
        <Command.GroupItems>
          {#each list.filter((entry) => entry.group === group) as entry (entry.value)}
            <Command.Item
              value={entry.value}
              label={entry.label}
              keywords={entry.keywords ?? []}
              class={commandItemClass()}
              data-tx-command-item=""
              data-demo-part="Command.Item"
              data-demo-item={entry.value}
            >
              <span class="tx-command__item-body"><span class="tx-command__item-label">{entry.label}</span></span>
            </Command.Item>
          {/each}
        </Command.GroupItems>
      </Command.Group>
    {/each}
  </Command.List>
{/snippet}

<!-- Command.Root's element carries the anatomy marker; the styled frame wraps it. -->
<div class={commandRootClass({ size, variant })} data-tx-command="" data-size={size} data-variant={variant}>
  {#if mode === 'uncontrolled'}
    <Command.Root label="Workspace commands" {loop} onSelect={(value) => (last = value)} data-demo-part="Command.Root">
      {@render palette(BASE)}
    </Command.Root>
  {:else}
    <Command.Root label="Project commands" {loop} shouldFilter={false} debounceMs={150} onSearch={search} onSelect={(value) => (last = value)} data-demo-part="Command.Root">
      {@render palette(results)}
    </Command.Root>
  {/if}
</div>
{#if mode === 'uncontrolled'}
  <p class="demo-controls"><output data-demo-readout>Last command: {last}</output></p>
{:else}
  <div class="demo-controls">
    <output data-demo-readout>query: "{query}" · results: {results.length} · last: {last}</output>
    <Button size="sm" variant="outline" onclick={addArchive} data-demo-act="add">Add "Archive project"</Button>
    <Button size="sm" variant="ghost" onclick={() => (entries = [...BASE])}>Reset list</Button>
  </div>
{/if}
