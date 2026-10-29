<script lang="ts">
/**
 * /documents-page/ workbench: one document in three views. The editor
 * (`@texuli/pages/editor`), the reader and the paged view load on first
 * use, after the island hydrates, so none of them is on the first paint.
 * Nested pages are documents of their own, kept in a map by reference;
 * export writes the current page with `@texuli/pages/export` (writers load
 * on the first click) and saves it as a Blob download.
 */
import type { TexuliDocument } from '@texuli/document/model';
import { HANDBOOK, HANDBOOK_REF, NESTED_PAGES } from './sample.ts';

type EditorModule = typeof import('@texuli/pages/editor');
type ReaderModule = typeof import('@texuli/pages/reader');
type PagedModule = typeof import('@texuli/pages/paged');
type ExportFormat = 'markdown' | 'docx' | 'pdf';
type View = 'edit' | 'read' | 'paged';
interface PageRef {
  ref: string;
  title: string;
}

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'edit', label: 'Edit' },
  { value: 'read', label: 'Read' },
  { value: 'paged', label: 'Pages' },
];
const FORMATS: readonly { value: ExportFormat; label: string }[] = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'docx', label: 'DOCX' },
  { value: 'pdf', label: 'PDF' },
];

let docs = $state.raw<Record<string, TexuliDocument>>({
  [HANDBOOK_REF.ref]: HANDBOOK,
  ...NESTED_PAGES,
});
/** The open page and the pages above it, outermost first. */
let current = $state(HANDBOOK_REF.ref);
let trail = $state.raw<readonly PageRef[]>([]);
let view = $state<View>('edit');
let created = 0;

let editorModule = $state.raw<EditorModule | null>(null);
let readerModule = $state.raw<ReaderModule | null>(null);
let pagedModule = $state.raw<PagedModule | null>(null);
let failed = $state('');
let pageCount = $state(0);
let exportStatus = $state('');
let exporting = $state<ExportFormat | null>(null);

const doc = $derived(docs[current] as TexuliDocument);

function load(next: View): void {
  const fail = () => {
    failed = 'This view could not load. Reload the page to try again.';
  };
  if (next === 'edit' && !editorModule)
    import('@texuli/pages/editor').then((module) => (editorModule = module), fail);
  if (next === 'read' && !readerModule)
    import('@texuli/pages/reader').then((module) => (readerModule = module), fail);
  if (next === 'paged' && !pagedModule)
    import('@texuli/pages/paged').then((module) => (pagedModule = module), fail);
}

// Runs once the island hydrates (the editor first), then on every view switch.
$effect(() => load(view));

function titleOf(ref: string): string {
  return docs[ref]?.meta.title ?? ref;
}

function navigate(ref: string): void {
  if (!docs[ref] || ref === current) return;
  const at = trail.findIndex((entry) => entry.ref === ref);
  if (at >= 0) trail = trail.slice(0, at);
  else trail = [...trail, { ref: current, title: titleOf(current) }];
  current = ref;
  exportStatus = '';
}

function createPage(): PageRef {
  created += 1;
  const ref = `pages/new-${created}`;
  const title = `Untitled page ${created}`;
  docs = {
    ...docs,
    [ref]: {
      format: 'texuli-document',
      formatVersion: 1,
      meta: { title, locale: 'en' },
      blocks: [{ id: `new-${created}-p`, type: 'paragraph', content: [] }],
    },
  };
  return { ref, title };
}

function onChange(next: TexuliDocument): void {
  docs = { ...docs, [current]: next };
}

function kb(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

async function runExport(format: ExportFormat): Promise<void> {
  exporting = format;
  exportStatus = `Writing ${format === 'markdown' ? 'Markdown' : format.toUpperCase()}…`;
  try {
    const { downloadBlob, exportDocument } = await import('@texuli/pages/export');
    const result = await exportDocument(doc, format);
    downloadBlob(result.blob, result.filename);
    const pages = result.pageCount ? `, ${result.pageCount} pages` : '';
    exportStatus = `Saved ${result.filename} (${kb(result.blob.size)}${pages}).`;
  } catch {
    exportStatus = 'The export failed. Nothing was saved.';
  } finally {
    exporting = null;
  }
}
</script>

<div class="workbench" data-documents-workbench="">
  <div class="workbench__bar">
    <fieldset class="workbench__views">
      <legend>View</legend>
      {#each VIEWS as option (option.value)}
        <label>
          <input type="radio" name="documents-view" value={option.value} bind:group={view} />
          {option.label}
        </label>
      {/each}
    </fieldset>
    <div class="workbench__export" role="group" aria-label="Export this page">
      <span class="workbench__export-label" aria-hidden="true">Export</span>
      {#each FORMATS as format (format.value)}
        <button
          type="button"
          class="workbench__button"
          aria-disabled={exporting !== null}
          data-documents-export={format.value}
          onclick={() => {
            if (exporting === null) void runExport(format.value);
          }}
        >
          {format.label}
        </button>
      {/each}
      {#if view === 'paged'}
        <button type="button" class="workbench__button" onclick={() => window.print()}>Print</button>
      {/if}
    </div>
  </div>
  <p class="workbench__status" role="status" data-documents-export-status="">{exportStatus}</p>

  <div class="workbench__stage" data-documents-view={view} data-documents-page={current}>
    {#if failed}
      <p class="workbench__note" role="alert">{failed}</p>
    {:else if view === 'edit'}
      {#if editorModule}
        {#key current}
          <editorModule.PageEditor
            document={doc}
            {onChange}
            label={`${titleOf(current)} (editor)`}
            trail={trail}
            onNavigate={navigate}
            {createPage}
          />
        {/key}
      {:else}
        <p class="workbench__note" data-documents-loading="">Loading the editor…</p>
      {/if}
    {:else if view === 'read'}
      {#if readerModule}
        <readerModule.PageReader
          document={doc}
          {trail}
          onNavigate={navigate}
          headingOffset={1}
          anchorPrefix="read-"
        />
      {:else}
        <p class="workbench__note">Loading the reader…</p>
      {/if}
    {:else if pagedModule}
      <p class="workbench__note" data-documents-page-count="">
        {pageCount > 0 ? `${pageCount} pages, A4 portrait. Print sends only these pages.` : 'Laying out the pages…'}
      </p>
      <pagedModule.PagedView document={doc} onLayout={(layout) => (pageCount = layout.pages.length)} />
    {:else}
      <p class="workbench__note">Loading the paged view…</p>
    {/if}
  </div>
</div>

<style>
  .workbench {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    min-inline-size: 0;
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
    gap: 0.75rem 1.5rem;
  }
  .workbench__views {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 1rem;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .workbench__views legend {
    float: inline-start;
    margin-inline-end: 0.5rem;
    padding: 0;
    font-weight: 600;
  }
  .workbench__views label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-block-size: 2.25rem;
  }
  .workbench__views input {
    accent-color: var(--tx-primary, Highlight);
  }
  .workbench__export {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .workbench__export-label {
    font-weight: 600;
    margin-inline-end: 0.25rem;
  }
  .workbench__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .workbench__button:hover {
    background: var(--tx-muted, ButtonFace);
  }
  .workbench__button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .workbench__button[aria-disabled='true'] {
    cursor: progress;
    opacity: 0.7;
  }
  .workbench__status {
    margin: 0;
    min-block-size: 1.25rem;
    font-size: 0.875rem;
  }
  .workbench__stage {
    min-block-size: 24rem;
    min-inline-size: 0;
    padding: clamp(0.5rem, 2vw, 1rem);
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
    overflow-x: auto;
  }
  .workbench__note {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
  }
  @media (forced-colors: active) {
    .workbench__button {
      border-color: ButtonText;
    }
    .workbench__button[aria-disabled='true'] {
      color: GrayText;
    }
  }
</style>
