<script lang="ts">
/**
 * The Rich text editor demo: one island over `@texuli/editor`. Fixture documents read as
 * untrusted Markdown, the toolbar with the block-type menu and the emoji button, Markdown in and
 * out, Markdown-aware paste (a sample HTML clipboard whose `javascript:` link is refused) and the
 * export to chat dialects with what each format loses. Nothing is saved or sent anywhere.
 */
import { blockText, caret, editorLeaves, isTextBlock } from '@texuli/core/editor-model';
import { EditorController } from '@texuli/editor/controller';
import { RichTextEditor } from '@texuli/editor/editor';
import { DialectExport } from '@texuli/editor/export';
import { documentToMarkdown, markdownToDocument } from '@texuli/editor/markdown';
import { type EditorScenario, PASTE_HTML, PASTE_MARKDOWN, SCENARIOS } from './scenarios.ts';

const read = (markdown: string) => markdownToDocument(markdown, { trust: 'untrusted' });
const first = SCENARIOS[0] as EditorScenario;

const controller = new EditorController({ doc: read(first.markdown).doc });
let scenarioId = $state<EditorScenario['id']>(first.id);
let markdownIn = $state(first.markdown);
let loadNote = $state('');
let pasteNote = $state('');
const markdownOut = $derived(documentToMarkdown(controller.doc));

function choose(scenario: EditorScenario) {
  scenarioId = scenario.id;
  markdownIn = scenario.markdown;
  controller.replace(read(scenario.markdown).doc);
  loadNote = '';
  pasteNote = '';
}

function loadMarkdown() {
  const result = read(markdownIn);
  controller.replace(result.doc);
  loadNote =
    result.diagnostics.length === 0
      ? 'Loaded. Every construct fits the editor.'
      : `Loaded with ${result.diagnostics.length} adjustment${result.diagnostics.length === 1 ? '' : 's'}: ${result.diagnostics.map((d) => d.message).join(' ')}`;
}

/** Put the caret at the end, on a new empty paragraph, so a sample paste lands after the text. */
function caretAtNewLine() {
  const blocks = editorLeaves(controller.doc)
    .map(({ block }) => block)
    .filter(isTextBlock);
  const last = blocks[blocks.length - 1];
  if (!last) return;
  controller.select(caret(last.id, blockText(last).length));
  controller.runInput('split-block');
}

function pasteHtml() {
  caretAtNewLine();
  const result = controller.paste({ getData: (type) => (type === 'text/html' ? PASTE_HTML : '') });
  pasteNote = `Pasted ${result.blocks} blocks from HTML. ${
    result.linksRemoved === 1
      ? 'One link was refused by the URL policy (javascript:) and kept as text; the script and the click handler were dropped.'
      : `${result.linksRemoved} links were refused by the URL policy and kept as text.`
  }`;
}

async function pasteMarkdown() {
  caretAtNewLine();
  const result = await controller.pasteMarkdown(PASTE_MARKDOWN);
  pasteNote = `Pasted ${result.blocks} blocks, read as Markdown.`;
}

/**
 * The `:shortcode:` lookup loads with the emoji catalog the first time the editor is used:
 * canonical shortcodes (`:party_popper:`) and then the common aliases (`:tada:`).
 */
let shortcodes: Promise<void> | null = null;
let shortcodesReady = $state(false);
function loadShortcodes() {
  shortcodes ??= import('@texuli/emojis/catalog').then(({ emojiCatalog }) => {
    const byName = new Map<string, string>();
    for (const record of emojiCatalog.records)
      byName.set(record.shortcode.slice(1, -1), record.unicode);
    for (const record of emojiCatalog.records)
      for (const alias of record.aliases) if (!byName.has(alias)) byName.set(alias, record.unicode);
    controller.setShortcodes((name) => byName.get(name));
    shortcodesReady = true;
  });
}
</script>

<div class="editor-demo" data-tx-editor-demo>
  <div class="scenarios" role="group" aria-label="Documents">
    {#each SCENARIOS as scenario (scenario.id)}
      <button
        type="button"
        class="scenario"
        aria-pressed={scenarioId === scenario.id}
        onclick={() => choose(scenario)}
        data-scenario={scenario.id}
      >
        {scenario.label}
      </button>
    {/each}
  </div>

  <div
    class="editor"
    onfocusin={loadShortcodes}
    data-shortcodes={shortcodesReady ? 'ready' : 'loading'}
  >
    <RichTextEditor
      {controller}
      blockMenu
      emoji
      label="Demo document"
      placeholder="Write, or pick a document above…"
    />
    <p class="hint">
      Try the text style menu, the emoji button, or type a shortcode such as <code>:tada:</code>.
      Press Mod+Alt+Shift+V to paste your clipboard as Markdown.
    </p>
  </div>

  <div class="panels">
    <section class="panel" aria-labelledby="editor-demo-markdown-title">
      <h3 id="editor-demo-markdown-title">Markdown in and out</h3>
      <label class="field">
        <span>Markdown source</span>
        <textarea bind:value={markdownIn} rows="6" spellcheck="false" data-tx-editor-demo-in></textarea>
      </label>
      <button type="button" class="action" onclick={loadMarkdown} data-tx-editor-demo-load>
        Load into the editor
      </button>
      <p class="note" role="status">{loadNote}</p>
      <h4 id="editor-demo-out-title">The document as Markdown</h4>
      <pre
        class="output"
        role="region"
        tabindex="0"
        aria-labelledby="editor-demo-out-title"
        data-tx-editor-demo-out>{markdownOut}</pre>
    </section>

    <section class="panel" aria-labelledby="editor-demo-paste-title">
      <h3 id="editor-demo-paste-title">Try pasting this HTML</h3>
      <p>
        A fictional wiki page on the clipboard: a safe link, a <code>javascript:</code> link, a
        click handler and a script.
      </p>
      <pre
        class="output"
        role="region"
        tabindex="0"
        aria-label="Clipboard HTML sample"
        data-tx-editor-demo-html>{PASTE_HTML}</pre>
      <div class="actions">
        <button type="button" class="action" onclick={pasteHtml} data-tx-editor-demo-paste-html>
          Paste the HTML
        </button>
        <button type="button" class="action" onclick={pasteMarkdown} data-tx-editor-demo-paste-md>
          Paste text as Markdown
        </button>
      </div>
      <p class="note" role="status" data-tx-editor-demo-paste-note>{pasteNote}</p>
    </section>

    <div class="panel panel--wide">
      <DialectExport {controller} dialect="slack" />
    </div>
  </div>
</div>

<style>
  .editor-demo {
    display: grid;
    gap: var(--tx-space-4);
    color: var(--tx-foreground, CanvasText);
  }

  .scenarios,
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--tx-space-2);
  }

  .scenario,
  .action {
    border: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-shape-radius-full);
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
    padding: var(--tx-space-1) var(--tx-space-3);
    min-block-size: 2.75rem;
    font: inherit;
    cursor: pointer;
  }

  .scenario[aria-pressed='true'] {
    background: var(--tx-accent, Highlight);
    color: var(--tx-accent-foreground, HighlightText);
    border-color: var(--tx-accent, Highlight);
  }

  .scenario:focus-visible,
  .action:focus-visible,
  .output:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }

  .editor {
    display: grid;
    gap: var(--tx-space-2);
  }

  .hint,
  .note,
  .panel p {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: var(--tx-type-label-size);
  }

  .panels {
    display: grid;
    gap: var(--tx-space-4);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  }

  .panel {
    display: grid;
    gap: var(--tx-space-2);
    align-content: start;
    min-inline-size: 0;
  }

  .panel--wide {
    grid-column: 1 / -1;
  }

  .panel h3,
  .panel h4 {
    margin: 0;
    font-size: var(--tx-type-body-size);
  }

  .field {
    display: grid;
    gap: var(--tx-space-1);
    font-size: var(--tx-type-label-size);
  }

  textarea,
  .output {
    box-sizing: border-box;
    inline-size: 100%;
    margin: 0;
    border: var(--tx-border-width-thin) solid var(--tx-input, var(--tx-border, ButtonBorder));
    border-radius: var(--tx-shape-radius-md);
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
    padding: var(--tx-space-2) var(--tx-space-3);
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: var(--tx-type-label-size);
  }

  .output {
    max-block-size: 14rem;
    overflow: auto;
    background: var(--tx-muted, var(--tx-surface, Canvas));
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  textarea {
    resize: vertical;
  }
</style>
