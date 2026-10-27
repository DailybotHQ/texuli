<script lang="ts">
import { Sortable, type SortableContainer } from '@texuli/primitives/sortable';

const labels: Record<string, string> = {
  research: 'Research competitors',
  outline: 'Outline the guide',
  pricing: 'Draft pricing page',
  review: 'Review onboarding copy',
  launch: 'Launch checklist',
  intro: 'Introduction',
  setup: 'Setup',
  install: 'Install',
  configure: 'Configure',
  usage: 'Usage',
  faq: 'FAQ',
  red: 'أحمر',
  green: 'أخضر',
  blue: 'أزرق',
  text: 'Text block',
  image: 'Image block',
  quote: 'Quote block',
  pinned: 'Pinned summary (locked)',
};
const label = (id: string) => labels[id] ?? labels[id.replace(/-copy(-\d+)?$/, '')] ?? id;

let board = $state<SortableContainer[]>([
  { id: 'backlog', items: ['research', 'outline', 'pricing'], group: 'board' },
  { id: 'doing', items: ['review'], group: 'board' },
  { id: 'done', items: ['launch'], group: 'board', maxItems: 3 },
]);
const columnNames: Record<string, string> = {
  backlog: 'Backlog',
  doing: 'Doing',
  done: 'Done (max 3)',
};
let selection = $state<string[]>([]);

let outline = $state<SortableContainer[]>([
  { id: 'outline-root', items: ['intro', 'setup', 'usage', 'faq'], group: 'outline' },
  { id: 'intro-kids', items: [], group: 'outline', parentId: 'intro' },
  { id: 'setup-kids', items: ['install', 'configure'], group: 'outline', parentId: 'setup' },
  { id: 'install-kids', items: [], group: 'outline', parentId: 'install' },
  { id: 'configure-kids', items: [], group: 'outline', parentId: 'configure' },
  { id: 'usage-kids', items: [], group: 'outline', parentId: 'usage' },
  { id: 'faq-kids', items: [], group: 'outline', parentId: 'faq' },
]);

let chips = $state<SortableContainer[]>([
  { id: 'chips', items: ['red', 'green', 'blue'], orientation: 'horizontal' },
]);

let page = $state<SortableContainer[]>([
  {
    id: 'palette',
    items: ['text', 'image', 'quote'],
    group: { name: 'blocks', pull: 'clone', put: false },
    sort: false,
  },
  { id: 'page', items: ['pinned'], group: 'blocks', locked: ['pinned'] },
]);

let grid = $state<SortableContainer[]>([
  { id: 'tiles', items: ['t1', 't2', 't3', 't4', 't5', 't6'], orientation: 'grid' },
]);

function toggle(id: string): void {
  selection = selection.includes(id)
    ? selection.filter((entry) => entry !== id)
    : [...selection, id];
}
</script>

<section data-example="primitives-sortable" aria-labelledby="sortable-demo-title" class="demo">
  <h2 id="sortable-demo-title">Sortable</h2>

  <h3>Board: move between columns, multi-select with the checkboxes</h3>
  <Sortable.Root bind:containers={board} {selection} crossContainers class="board">
    {#each board as column (column.id)}
      <div class="column">
        <h4>{columnNames[column.id]}</h4>
        <Sortable.List id={column.id} label={columnNames[column.id]} class="list">
          {#snippet children({ items })}
            {#each items as id (id)}
              <Sortable.Item {id} label={label(id)} class="card">
                <Sortable.Handle class="handle">⠿</Sortable.Handle>
                <input
                  type="checkbox"
                  aria-label={`Select ${label(id)}`}
                  checked={selection.includes(id)}
                  onchange={() => toggle(id)}
                />
                <span>{label(id)}</span>
              </Sortable.Item>
            {/each}
          {/snippet}
        </Sortable.List>
      </div>
    {/each}
  </Sortable.Root>

  <h3>Nested outline: Right arrow nests, Left arrow un-nests</h3>
  <Sortable.Root bind:containers={outline} nestZone={1 / 3} maxDepth={3}>
    {@render tree('outline-root')}
  </Sortable.Root>

  <h3 dir="rtl" lang="ar">رقائق (من اليمين إلى اليسار)</h3>
  <div dir="rtl" lang="ar">
    <Sortable.Root
      bind:containers={chips}
      messages={{ roleDescription: 'عنصر قابل للسحب', moved: '{item}: الموضع {position} من {total}.' }}
    >
      <Sortable.List id="chips" label="الألوان" class="chips">
        {#snippet children({ items })}
          {#each items as id (id)}
            <Sortable.Item {id} label={label(id)} class="chip">
              <Sortable.Handle class="handle">{label(id)}</Sortable.Handle>
            </Sortable.Item>
          {/each}
        {/snippet}
      </Sortable.List>
    </Sortable.Root>
  </div>

  <h3>Palette that clones into a page with a locked item</h3>
  <Sortable.Root bind:containers={page} preview="overlay" class="board">
    {#each page as list (list.id)}
      <Sortable.List id={list.id} label={list.id === 'palette' ? 'Block palette' : 'Page'} class="list">
        {#snippet children({ items })}
          {#each items as id (id)}
            <Sortable.Item {id} label={label(id)} class="card">
              <Sortable.Handle class="handle">⠿</Sortable.Handle>
              <span>{label(id)}</span>
            </Sortable.Item>
          {/each}
        {/snippet}
      </Sortable.List>
    {/each}
  </Sortable.Root>

  <h3>Swap grid</h3>
  <Sortable.Root bind:containers={grid} mode="swap">
    <Sortable.List id="tiles" label="Tiles" class="grid">
      {#snippet children({ items })}
        {#each items as id (id)}
          <Sortable.Item {id} label={`Tile ${id.slice(1)}`} class="tile">
            <Sortable.Handle class="handle">Tile {id.slice(1)}</Sortable.Handle>
          </Sortable.Item>
        {/each}
      {/snippet}
    </Sortable.List>
  </Sortable.Root>
</section>

{#snippet tree(listId: string)}
  <Sortable.List id={listId} label={listId === 'outline-root' ? 'Guide outline' : `${label(listId.replace(/-kids$/, ''))} children`} class="tree">
    {#snippet children({ items })}
      {#each items as id (id)}
        <Sortable.Item {id} label={label(id)} class="node">
          <div class="row">
            <Sortable.Handle class="handle">⠿</Sortable.Handle>
            <span>{label(id)}</span>
          </div>
          {#each outline.filter((entry) => entry.parentId === id) as child (child.id)}
            {@render tree(child.id)}
          {/each}
        </Sortable.Item>
      {/each}
    {/snippet}
  </Sortable.List>
{/snippet}

<style>
  .demo {
    display: grid;
    gap: 12px;
  }

  .demo :global(.board) {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .column {
    flex: 1 1 200px;
  }

  .demo :global(.list),
  .demo :global(.tree),
  .demo :global(.chips),
  .demo :global(.grid) {
    list-style: none;
    margin: 0;
    padding: 4px;
    min-block-size: 48px;
    border: 1px solid currentColor;
    border-radius: 8px;
  }

  .demo :global(.tree .tree) {
    margin-inline-start: 24px;
    min-block-size: 0;
    border: 0;
  }

  .demo :global(.chips) {
    display: flex;
    gap: 8px;
  }

  .demo :global(.grid) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .demo :global(.card),
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-block-size: 40px;
  }

  .demo :global(.handle) {
    min-inline-size: 32px;
    min-block-size: 32px;
  }
</style>
