<script lang="ts">
import { TreeDataView, type TreeMove } from '@texuli/data/tree-view';

interface Page {
  id: string;
  title: string;
  detail: string;
  parentId: string | null;
  rank: string;
  lazy?: boolean;
}

let pages = $state<Page[]>([
  { id: 'workspace', title: 'Workspace', detail: 'Root', parentId: null, rank: 'a0' },
  { id: 'guides', title: 'Guides', detail: 'Folder', parentId: 'workspace', rank: 'a0' },
  {
    id: 'getting-started',
    title: 'Getting started',
    detail: 'Page',
    parentId: 'guides',
    rank: 'a0',
  },
  { id: 'keyboard', title: 'Keyboard paths', detail: 'Page', parentId: 'guides', rank: 'a1' },
  { id: 'api', title: 'API reference', detail: 'Page', parentId: 'workspace', rank: 'a1' },
  {
    id: 'remote',
    title: 'Remote drafts',
    detail: 'Lazy folder',
    parentId: null,
    rank: 'a1',
    lazy: true,
  },
]);

let selected = $state<string[]>(['getting-started']);
let expanded = $state<string[]>(['workspace', 'guides']);
let direction = $state<'ltr' | 'rtl'>('ltr');
let lastEvent = $state('Ready.');

const lazyCatalog: Record<string, Page[]> = {
  remote: [
    {
      id: 'remote-alpha',
      title: 'Alpha draft',
      detail: 'Loaded child',
      parentId: 'remote',
      rank: 'a0',
    },
    {
      id: 'remote-beta',
      title: 'Beta draft',
      detail: 'Loaded child',
      parentId: 'remote',
      rank: 'a1',
    },
  ],
};

async function loadChildren(page: Page): Promise<Page[]> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return lazyCatalog[page.id] ?? [];
}

function onChildrenLoaded(parent: Page, children: readonly Page[]): void {
  pages = [...pages.filter((page) => page.parentId !== parent.id), ...children];
  lastEvent = `Loaded ${children.length} child${children.length === 1 ? '' : 'ren'} under ${parent.title}.`;
}

function onMove(move: TreeMove): void {
  const ranks = new Map((move.rerank ?? []).map((entry) => [entry.id, entry.rank]));
  pages = pages.map((page) => {
    if (page.id === move.id) {
      return { ...page, parentId: move.parentId, rank: move.rank };
    }
    const rank = ranks.get(page.id);
    return rank === undefined ? page : { ...page, parentId: move.parentId, rank };
  });
  lastEvent = `Moved ${move.id} (parent ${move.parentId ?? 'root'}).`;
}
</script>

<section data-example="data-tree-view" aria-labelledby="data-tree-view-title" dir={direction}>
  <header class="head">
    <div>
      <h2 id="data-tree-view-title">Tree data view</h2>
      <p>
        Fictional workspace outline with checkboxes, drag handles, lazy folders and keyboard
        outline edits (Alt+arrows, Tab / Shift+Tab).
      </p>
    </div>
    <div class="controls" role="group" aria-label="Tree demo controls">
      <button type="button" onclick={() => (direction = direction === 'ltr' ? 'rtl' : 'ltr')}>
        Direction: {direction}
      </button>
    </div>
  </header>

  <TreeDataView
    items={pages}
    bind:selected
    bind:expanded
    dir={direction}
    getId={(page) => page.id}
    getParentId={(page) => page.parentId}
    getRank={(page) => page.rank}
    getLabel={(page) => page.title}
    hasChildren={(page) => page.lazy === true}
    {loadChildren}
    {onChildrenLoaded}
    {onMove}
    labels={{ tree: 'Workspace outline' }}
    class="demo-tree"
  >
    {#snippet item(page)}
      <span class="title">{page.title}</span>
      <span class="detail">{page.detail}</span>
    {/snippet}
  </TreeDataView>

  <p class="meta" role="status">{lastEvent} Selected: {selected.join(', ') || 'none'}.</p>

  <section class="rtl-fixed" aria-labelledby="data-tree-view-rtl-title" dir="rtl">
    <h3 id="data-tree-view-rtl-title">Right-to-left fixed preview</h3>
    <TreeDataView
      items={pages}
      selected={['api']}
      expanded={['workspace', 'guides']}
      dir="rtl"
      getId={(page) => page.id}
      getParentId={(page) => page.parentId}
      getRank={(page) => page.rank}
      getLabel={(page) => page.title}
      checkboxes={true}
      labels={{ tree: 'Right-to-left workspace outline' }}
      class="demo-tree"
    />
  </section>
</section>

<style>
  section[data-example='data-tree-view'] {
    max-inline-size: 40rem;
    color: var(--tx-text, CanvasText);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-block-end: 1rem;
  }

  .head h2,
  .rtl-fixed h3 {
    margin: 0;
  }

  .head p {
    margin-block: 0.35rem 0;
    max-inline-size: 36rem;
  }

  .controls button {
    min-block-size: 2.5rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.5rem;
    background: var(--tx-surface, Canvas);
    color: inherit;
    cursor: pointer;
  }

  .meta {
    margin-block: 0.75rem 0;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, GrayText);
  }

  .rtl-fixed {
    margin-block-start: 2rem;
  }

  .rtl-fixed h3 {
    margin-block-end: 0.75rem;
  }

  :global(.demo-tree .tx-tree-view__content .title) {
    font-weight: 600;
  }

  :global(.demo-tree .tx-tree-view__content .detail) {
    font-size: 0.8125rem;
    color: var(--tx-foreground, CanvasText);
  }

  :global(.demo-tree .tx-tree-view__row--selected .detail) {
    color: inherit;
  }
</style>
