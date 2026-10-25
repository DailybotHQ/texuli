<script lang="ts">
import { FileBrowser, type FileEntry } from '@texuli/data/files';

let entries = $state<FileEntry[]>([
  { id: 'library', parentId: null, name: 'Library', kind: 'folder', updatedAt: '2026-02-01' },
  { id: 'design', parentId: 'library', name: 'Design', kind: 'folder', updatedAt: '2026-02-02' },
  {
    id: 'mock',
    parentId: 'design',
    name: 'Mockups.png',
    kind: 'file',
    type: 'image/png',
    size: 245_760,
    updatedAt: '2026-02-03',
  },
  {
    id: 'tokens',
    parentId: 'design',
    name: 'Tokens.json',
    kind: 'file',
    type: 'application/json',
    size: 4096,
    updatedAt: '2026-02-04',
  },
  {
    id: 'specs',
    parentId: 'library',
    name: 'Specs',
    kind: 'folder',
    updatedAt: '2026-02-05',
  },
  {
    id: 'brief',
    parentId: 'specs',
    name: 'Product-brief.pdf',
    kind: 'file',
    type: 'application/pdf',
    size: 98_304,
    updatedAt: '2026-02-06',
  },
  {
    id: 'notes',
    parentId: null,
    name: 'Readme.md',
    kind: 'file',
    type: 'text/markdown',
    size: 1520,
    updatedAt: '2026-02-07',
  },
  {
    id: 'archive',
    parentId: null,
    name: 'Exports.zip',
    kind: 'file',
    type: 'application/zip',
    size: 1_048_576,
    updatedAt: '2026-02-08',
  },
]);

let folderId = $state<string | null>(null);
let selected = $state<string[]>(['notes']);
let layout = $state<'grid' | 'list'>('grid');
let direction = $state<'ltr' | 'rtl'>('ltr');
let lastOpen = $state('No file opened yet.');

function onOpenFile(entry: FileEntry): void {
  lastOpen = `Opened ${entry.name}.`;
}
</script>

<section data-example="data-files" aria-labelledby="data-files-title" dir={direction}>
  <header class="head">
    <div>
      <h2 id="data-files-title">File browser</h2>
      <p>
        Fictional workspace library with breadcrumbs, grid/list layout, multi-select and a side
        preview. Use arrows, Enter, Space and Backspace.
      </p>
    </div>
    <div class="controls" role="group" aria-label="File demo controls">
      <button type="button" onclick={() => (direction = direction === 'ltr' ? 'rtl' : 'ltr')}>
        Direction: {direction}
      </button>
    </div>
  </header>

  <FileBrowser
    {entries}
    bind:folderId
    bind:selected
    bind:layout
    dir={direction}
    gridColumns={3}
    {onOpenFile}
    labels={{
      browser: 'Harbor files',
      breadcrumbs: 'Main location',
      preview: 'Main preview',
      items: 'Main files',
    }}
    class="demo-files"
  />

  <p class="meta" role="status">{lastOpen}</p>

  <section class="rtl-fixed" aria-labelledby="data-files-rtl-title" dir="rtl">
    <h3 id="data-files-rtl-title">Right-to-left fixed preview</h3>
    <FileBrowser
      {entries}
      folderId="library"
      selected={['design']}
      layout="list"
      dir="rtl"
      labels={{
        browser: 'Harbor files, right to left',
        breadcrumbs: 'RTL location',
        preview: 'RTL preview',
        items: 'RTL files',
      }}
      class="demo-files"
    />
  </section>
</section>

<style>
  section[data-example='data-files'] {
    max-inline-size: 56rem;
    color: var(--tx-foreground, var(--tx-text, CanvasText));
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
    max-inline-size: 40rem;
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
</style>
