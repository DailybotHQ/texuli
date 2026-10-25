# File browser

**Package:** `@texuli/data`  
**Lazy subpath:** `@texuli/data/files`  
**Engine:** `packages/data/src/engines/files/` (also `@texuli/data/files/engine`)  
**View:** `packages/data/src/files/`  
**Tests:** `packages/data/tests/files.test.ts`  
**Example:** `data-files`

## Goal

A grid/list file browser over flat `{ id, parentId, name, kind, … }` rows with:

- Breadcrumb navigation (root + folder path)
- Grid and list layouts with multi-select
- Side preview (deterministic SVG thumbnail or host `getPreviewSrc` via URL policy)
- Keyboard: arrows (grid-aware, RTL), Enter open, Space select, Backspace up
- Logical CSS; AA tokens with forced-colors fallbacks

## Usage

```svelte
<script lang="ts">
  import { FileBrowser, type FileEntry } from '@texuli/data/files';

  let entries = $state<FileEntry[]>([
    { id: 'docs', parentId: null, name: 'Docs', kind: 'folder' },
    {
      id: 'brief',
      parentId: 'docs',
      name: 'Brief.pdf',
      kind: 'file',
      type: 'application/pdf',
      size: 2048,
    },
  ]);
  let folderId = $state<string | null>(null);
  let selected = $state<string[]>([]);
  let layout = $state<'grid' | 'list'>('grid');
</script>

<FileBrowser {entries} bind:folderId bind:selected bind:layout />
```

## Engine vs view

| Layer | Import | Role |
| --- | --- | --- |
| Engine | `@texuli/data/files` re-exports or `/files/engine` | `childrenOf`, `breadcrumbs`, `thumbnailUrl`, `formatSize` |
| View | `FileBrowser` | layout, selection, preview, keyboard |

Generated thumbnails are `data:image/svg+xml` URLs passed through `safeImageSrc(..., 'developer')`.
