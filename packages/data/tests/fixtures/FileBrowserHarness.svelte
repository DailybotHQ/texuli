<script lang="ts">
import { FileBrowser, type FileEntry } from '../../src/files/index.ts';

let entries = $state<FileEntry[]>([
  { id: 'docs', parentId: null, name: 'Docs', kind: 'folder', updatedAt: '2026-02-01' },
  {
    id: 'brief',
    parentId: 'docs',
    name: 'Brief.pdf',
    kind: 'file',
    type: 'application/pdf',
    size: 2048,
    updatedAt: '2026-02-02',
  },
  {
    id: 'photo',
    parentId: 'docs',
    name: 'Harbor.png',
    kind: 'file',
    type: 'image/png',
    size: 4096,
    updatedAt: '2026-02-03',
  },
  {
    id: 'notes',
    parentId: null,
    name: 'Notes.txt',
    kind: 'file',
    type: 'text/plain',
    size: 128,
    updatedAt: '2026-02-04',
  },
  { id: 'empty', parentId: null, name: 'Empty', kind: 'folder', updatedAt: '2026-02-05' },
]);

let folderId = $state<string | null>(null);
let selected = $state<string[]>([]);
let layout = $state<'grid' | 'list'>('grid');
let opens = $state<string[]>([]);

function onOpenFile(entry: FileEntry): void {
  opens = [...opens, entry.id];
}
</script>

<FileBrowser
  {entries}
  bind:folderId
  bind:selected
  bind:layout
  gridColumns={2}
  {onOpenFile}
/>
<output aria-label="Folder id">{folderId ?? 'root'}</output>
<output aria-label="Selected ids">{selected.join(',')}</output>
<output aria-label="Layout mode">{layout}</output>
<output aria-label="Open count">{opens.length}</output>
