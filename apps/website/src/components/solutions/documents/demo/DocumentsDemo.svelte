<script lang="ts">
/** Interactive document proof; the editor and reader load after an explicit start. */
import type { TexuliDocument } from '@texuli/document/model';
import type { Component } from 'svelte';
import type { DocumentsDemo, DocumentsDemoAction, DocumentsDemoState } from './model.ts';

type EditorProps = {
  document: TexuliDocument;
  label: string;
  motion: false;
  onChange: (document: TexuliDocument) => void;
};

type ReaderProps = {
  document: TexuliDocument;
  anchorPrefix: string;
  reducedMotion: true;
};

let demo: DocumentsDemo | null = null;
let state = $state.raw<DocumentsDemoState | null>(null);
let Editor = $state<Component<EditorProps> | null>(null);
let Reader = $state<Component<ReaderProps> | null>(null);
let Controls = $state<Component | null>(null);
let started = $state(false);
let loading = $state(false);
let failed = $state(false);
let sourceVisible = $state(false);
let announcement = $state('Start the interactive demo to explore the product report.');
let createDemo: typeof import('./model.ts').createDocumentsDemo | null = null;

function say(prefix: string, next = state): void {
  if (!next) return;
  announcement = `${prefix}. ${next.document.meta.title}. ${next.blockCount} blocks.`;
}

function onEditorChange(document: TexuliDocument): void {
  // The Pages editor owns its text-operation history. Rebase the demo model on
  // each accepted edit so the demo controls always act on the visible document.
  if (!demo || !createDemo) return;
  demo = createDemo(document);
  state = demo.state;
  say('Document updated');
}

function dispatch(action: DocumentsDemoAction): void {
  if (!demo || !createDemo) return;

  // Keep the model's operation history for its explicit actions while rebasing
  // after edits made through the package editor.
  if (state && demo.state.document !== state.document) demo = createDemo(state.document);
  const next = demo.dispatch(action);
  state = next;
  if (action.type === 'reset') sourceVisible = false;
  if (action.type === 'toggle-mode' || action.type === 'set-mode') {
    say(next.mode === 'read' ? 'Read view opened' : 'Edit view opened', next);
  } else if (action.type === 'reset') say('Example reset', next);
  else if (action.type === 'undo') say(next.error ? 'Nothing to undo' : 'Last change undone', next);
  else if (action.type === 'redo') say(next.error ? 'Nothing to redo' : 'Change restored', next);
  else if (action.type === 'rename-title')
    say(next.error ? 'Title was not changed' : 'Title updated', next);
  else if (action.type === 'add-block')
    say(next.error ? 'Block was not added' : 'Block added', next);
}

async function startDemo(): Promise<void> {
  if (started || loading || failed) return;
  loading = true;
  try {
    const [modelModule, editorModule, readerModule, controlsModule] = await Promise.all([
      import('./model.ts'),
      import('@texuli/pages/editor-core'),
      import('@texuli/pages/reader-core'),
      import('./ui/DocumentsDemoControls.svelte'),
    ]);
    createDemo = modelModule.createDocumentsDemo;
    demo = modelModule.createDocumentsDemo();
    state = demo.state;
    Editor = editorModule.PageEditorCore as unknown as Component<EditorProps>;
    Reader = readerModule.PageReaderCore as unknown as Component<ReaderProps>;
    Controls = controlsModule.default;
    announcement = `${state.document.meta.title} is ready. Use the document controls to edit or read.`;
    started = true;
  } catch {
    failed = true;
    announcement =
      'The document editor could not load. The static report preview remains available.';
  } finally {
    loading = false;
  }
}

function toggleSource(): void {
  sourceVisible = !sourceVisible;
  announcement = sourceVisible ? 'Document source shown.' : 'Document source hidden.';
}
</script>

<section
  class="documents-demo"
  aria-label="Interactive product report example"
  data-tx-documents-demo=""
  data-demo-live={started && state ? '' : undefined}
>
  {#if !started && !loading && !failed}
    <button type="button" class="documents-demo__start" onclick={startDemo}>Start interactive demo</button>
    <p class="documents-demo__hint">The report preview is ready; editing tools load when you start.</p>
  {:else if loading}
    <p class="documents-demo__hint" role="status">Loading document tools…</p>
  {:else if failed}
    <p class="documents-demo__error" role="alert">
      The document editor could not load. The static report preview remains available above.
    </p>
  {:else if state && Controls}
    {@const DemoControls = Controls}
    <DemoControls demoState={state} {sourceVisible} {announcement} onAction={dispatch} onSource={toggleSource} />
    {#if state.mode === 'edit' && Editor}
      {@const DocumentEditor = Editor}
      <DocumentEditor
        document={state.document}
        label="Edit product report"
        motion={false}
        onChange={onEditorChange}
      />
    {:else if Reader}
      {@const DocumentReader = Reader}
      <DocumentReader
        document={state.document}
        anchorPrefix="documents-demo-reader"
        reducedMotion={true}
      />
    {/if}
  {/if}

  {#if sourceVisible && state}
    <section id="documents-demo-source" class="documents-demo__source" aria-label="Document source as JSON">
      <h3>Document source</h3>
      <pre><code>{JSON.stringify(state.document, null, 2)}</code></pre>
    </section>
  {/if}
</section>

<style>
  .documents-demo {
    display: grid;
    gap: 0.85rem;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  .documents-demo__start {
    justify-self: start;
    min-block-size: 2.75rem;
    padding-inline: 1rem;
    border: 1px solid var(--tx-border, GrayText);
    border-radius: var(--tx-radius, 0.5rem);
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
    touch-action: manipulation;
  }

  .documents-demo__start:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }

  .documents-demo__hint,
  .documents-demo__error {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }

  .documents-demo__error {
    color: var(--tx-danger-foreground, MarkText);
  }

  .documents-demo__source {
    min-inline-size: 0;
  }

  .documents-demo__source pre {
    max-block-size: 24rem;
    overflow: auto;
    padding: 1rem;
    border: 1px solid var(--tx-border, GrayText);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-muted, Canvas);
    font-size: 0.8rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
