<script lang="ts">
// The slash menu: an APG combobox with a listbox on the owned primitives.
// Typing filters (ranked: label prefix first); the first match is active, so
// Enter inserts it; arrows move; Escape, or Backspace on an empty filter,
// closes the menu and returns to the text.
import { Combobox } from '@texuli/primitives/combobox';
import { untrack } from 'svelte';
import { getPagesContext } from './context.ts';
import SlashActive from './SlashActive.svelte';
import { filterSlashItems } from './slash.ts';
import type { PagesSlashRequest } from './state.svelte.ts';

let { request }: { request: PagesSlashRequest } = $props();

const context = getPagesContext();
const editor = context.editor;
const labels = $derived(editor.labels);
const uid = $props.id();
let query = $state('');
let open = $state(true);
let input = $state<HTMLInputElement | null>(null);

const filtered = $derived(filterSlashItems(context.items(), query));
const options = $derived(filtered.map((item) => ({ value: item.value, label: item.label })));

$effect(() => {
  const element = input;
  if (element) untrack(() => element.focus({ preventScroll: true }));
});

let chosen = false;

function choose(value: string | readonly string[]): void {
  const item = filtered.find((candidate) => candidate.value === value);
  if (!item || chosen) return;
  chosen = true;
  void editor.insertItem(item, request, context.createPage);
}

function onkeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    editor.closeSlash(true);
  } else if (event.key === 'Backspace' && query === '') {
    event.preventDefault();
    editor.closeSlash(true);
  } else if (event.key === 'Tab') {
    editor.closeSlash(false);
  }
}

function onopenchange(next: boolean): void {
  // Dismissed from outside (a click elsewhere): close without stealing focus back.
  if (!next && !chosen) queueMicrotask(() => editor.slash === request && editor.closeSlash(false));
}
</script>

<div class="tx-pages-slash" data-anchor={request.anchor}>
  <Combobox.Root items={options} filter={() => true} bind:open bind:inputValue={query} onValueChange={choose} onOpenChange={onopenchange}>
    <label class="tx-pages-visually-hidden" for={`${uid}-slash`}>{labels.slashMenu}</label>
    <Combobox.Input
      id={`${uid}-slash`}
      class="tx-pages-slash__input"
      placeholder={labels.slashFilter}
      bind:ref={input}
      {onkeydown}
    />
    <Combobox.Content class="tx-pages-slash__list" aria-label={labels.slashMenu}>
      <Combobox.Empty class="tx-pages-slash__empty">{labels.slashEmpty}</Combobox.Empty>
      <Combobox.Viewport>
        {#snippet children(option)}
          {@const item = filtered.find((candidate) => candidate.value === option.value)}
          <Combobox.Item value={option.value} class="tx-pages-slash__item" data-group={item?.group}>
            <span class="tx-pages-slash__label">{option.label}</span>
            {#if item}<span class="tx-pages-slash__group" aria-hidden="true">{labels.slashGroups[item.group]}</span>{/if}
          </Combobox.Item>
        {/snippet}
      </Combobox.Viewport>
    </Combobox.Content>
    <SlashActive first={options[0]?.value} />
  </Combobox.Root>
</div>
