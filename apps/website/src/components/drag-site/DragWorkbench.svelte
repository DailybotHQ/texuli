<script lang="ts">
import { getAnnouncer } from '@texuli/core/announcer';
import { Sortable, type SortableContainer } from '@texuli/primitives/sortable';
import { DRAG_INSTRUCTIONS, LABELS, labelOf } from './data.ts';

/**
 * The /drag-page/ hero: a sortable list, a board and a tree, three surfaces
 * on one engine (@texuli/drag through @texuli/primitives/sortable). Every
 * announcement goes to the polite live region and to the visible log.
 */

let showKeys = $state(true);
let reduceMotion = $state(false);
let rtl = $state(false);
let log = $state.raw<readonly { id: number; surface: string; text: string }[]>([]);
let nextId = 0;
let root = $state<HTMLElement | null>(null);

function announcer(surface: string) {
  return (message: string) => {
    log = [{ id: nextId++, surface, text: message }, ...log].slice(0, 6);
    if (root) getAnnouncer(root.ownerDocument).announce(message, 'polite');
  };
}

let list = $state<SortableContainer[]>([
  { id: 'priorities', items: ['launch-notes', 'pricing-page', 'status-page', 'invoices'] },
]);

let board = $state<SortableContainer[]>([
  { id: 'todo', items: ['audit-forms', 'dark-mode', 'export-csv'], group: 'board' },
  { id: 'doing', items: ['search-index'], group: 'board' },
  { id: 'done', items: ['onboarding'], group: 'board', maxItems: 3 },
]);

let tree = $state<SortableContainer[]>([
  { id: 'site', items: ['guides', 'reference', 'changelog'], group: 'tree' },
  { id: 'guides-kids', items: ['install', 'theming'], group: 'tree', parentId: 'guides' },
  { id: 'install-kids', items: [], group: 'tree', parentId: 'install' },
  { id: 'theming-kids', items: [], group: 'tree', parentId: 'theming' },
  { id: 'reference-kids', items: ['tokens'], group: 'tree', parentId: 'reference' },
  { id: 'tokens-kids', items: [], group: 'tree', parentId: 'tokens' },
  { id: 'changelog-kids', items: [], group: 'tree', parentId: 'changelog' },
]);

const preview = $derived(reduceMotion ? 'overlay' : 'in-place');
</script>

<section class="workbench" aria-labelledby="workbench-title" bind:this={root}>
  <div class="workbench__bar">
    <h2 id="workbench-title" class="workbench__title">One engine, three surfaces</h2>
    <fieldset class="workbench__toggles">
      <legend class="sr-only">Workbench options</legend>
      <label><input type="checkbox" bind:checked={showKeys} /> Keyboard instructions</label>
      <label><input type="checkbox" bind:checked={reduceMotion} /> Reduced motion</label>
      <label><input type="checkbox" bind:checked={rtl} /> Right to left</label>
    </fieldset>
  </div>

  {#if showKeys}
    <p class="workbench__keys" data-drag-keys>{DRAG_INSTRUCTIONS}</p>
  {/if}

  <div class="workbench__surfaces" dir={rtl ? 'rtl' : 'ltr'} data-drag-dir={rtl ? 'rtl' : 'ltr'}>
    <article class="surface">
      <h3 class="surface__title">Sortable list</h3>
      <Sortable.Root bind:containers={list} {preview} announce={announcer('List')}>
        <Sortable.List id="priorities" label={LABELS.priorities} class="stack">
          {#snippet children({ items })}
            {#each items as id (id)}
              <Sortable.Item {id} label={labelOf(id)} class="chip">
                <Sortable.Handle class="grip"><span aria-hidden="true">⠿</span></Sortable.Handle>
                <span>{labelOf(id)}</span>
              </Sortable.Item>
            {/each}
          {/snippet}
        </Sortable.List>
      </Sortable.Root>
    </article>

    <article class="surface surface--wide">
      <h3 class="surface__title">Board</h3>
      <Sortable.Root bind:containers={board} {preview} crossContainers announce={announcer('Board')}>
        <div class="board">
          {#each board as column (column.id)}
            <div class="board__column">
              <h4 class="board__title">{LABELS[column.id]}</h4>
              <Sortable.List id={column.id} label={LABELS[column.id]} class="stack stack--column">
                {#snippet children({ items })}
                  {#each items as id (id)}
                    <Sortable.Item {id} label={labelOf(id)} class="chip">
                      <Sortable.Handle class="grip"><span aria-hidden="true">⠿</span></Sortable.Handle>
                      <span>{labelOf(id)}</span>
                    </Sortable.Item>
                  {/each}
                {/snippet}
              </Sortable.List>
            </div>
          {/each}
        </div>
      </Sortable.Root>
    </article>

    <article class="surface">
      <h3 class="surface__title">Tree</h3>
      <Sortable.Root bind:containers={tree} {preview} nestZone={1 / 3} maxDepth={3} announce={announcer('Tree')}>
        {@render branch('site')}
      </Sortable.Root>
    </article>
  </div>

  <div class="workbench__log">
    <h3 class="surface__title" id="workbench-log-title">Announcements</h3>
    <p class="workbench__hint">What a screen reader hears, newest first.</p>
    {#if log.length === 0}
      <p class="workbench__empty">Move an item to see its announcements.</p>
    {:else}
      <ol class="workbench__entries" aria-labelledby="workbench-log-title" data-drag-log>
        {#each log as entry (entry.id)}
          <li><span class="workbench__source">{entry.surface}</span> {entry.text}</li>
        {/each}
      </ol>
    {/if}
  </div>
</section>

{#snippet branch(listId: string)}
  <Sortable.List id={listId} label={LABELS[listId] ?? `${labelOf(listId.replace(/-kids$/, ''))} pages`} class="tree">
    {#snippet children({ items })}
      {#each items as id (id)}
        <Sortable.Item {id} label={labelOf(id)} class="tree__node">
          <div class="chip chip--row">
            <Sortable.Handle class="grip"><span aria-hidden="true">⠿</span></Sortable.Handle>
            <span>{labelOf(id)}</span>
          </div>
          {#each tree.filter((entry) => entry.parentId === id) as child (child.id)}
            {@render branch(child.id)}
          {/each}
        </Sortable.Item>
      {/each}
    {/snippet}
  </Sortable.List>
{/snippet}

<style>
  .workbench {
    display: grid;
    gap: 1rem;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .workbench__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .workbench__title,
  .surface__title {
    margin: 0;
    font-size: 1.0625rem;
  }
  .workbench__toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .workbench__toggles label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-block-size: 2.25rem;
  }
  .workbench__keys,
  .workbench__hint,
  .workbench__empty {
    margin: 0;
    color: var(--tx-muted-foreground, CanvasText);
    font-size: 0.875rem;
  }
  .workbench__surfaces {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
    gap: 1rem;
  }
  .surface {
    display: grid;
    align-content: start;
    gap: 0.6rem;
    min-inline-size: 0;
  }
  .surface--wide {
    grid-column: 1 / -1;
  }
  .board {
    display: grid;
    grid-template-columns: repeat(3, minmax(9rem, 1fr));
    gap: 0.75rem;
    overflow-x: auto;
    padding-block-end: 0.25rem;
  }
  .board__column {
    display: grid;
    align-content: start;
    gap: 0.4rem;
    min-inline-size: 0;
  }
  .board__title {
    margin: 0;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .workbench :global(.stack),
  .workbench :global(.tree) {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0.4rem;
    list-style: none;
    border-radius: 0.75rem;
    background: var(--tx-muted, Canvas);
    min-block-size: 3rem;
  }
  .workbench :global(.tree .tree) {
    margin-inline-start: 1.25rem;
    padding: 0.25rem 0 0;
    min-block-size: 0;
    background: transparent;
  }
  .workbench :global(.chip) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-block-size: 2.5rem;
    padding: 0.25rem 0.6rem 0.25rem 0.25rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.6rem;
    background: var(--tx-surface, Canvas);
  }
  .workbench :global(.tree__node) {
    display: grid;
    gap: 0.25rem;
  }
  .workbench :global(.grip) {
    display: inline-grid;
    place-items: center;
    min-inline-size: 2rem;
    min-block-size: 2rem;
    border: 0;
    border-radius: 0.45rem;
    background: transparent;
    color: inherit;
  }
  .workbench :global(.grip:hover) {
    background: var(--tx-muted, Canvas);
  }
  .workbench__log {
    display: grid;
    gap: 0.35rem;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: var(--tx-muted, Canvas);
  }
  .workbench__entries {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding-inline-start: 1.25rem;
    font-size: 0.875rem;
  }
  .workbench__source {
    font-weight: 600;
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (forced-colors: active) {
    .workbench :global(.chip),
    .workbench {
      border-color: CanvasText;
    }
  }
</style>
