<script lang="ts">
/**
 * The /slides-page/ live editors: write a deck as JSON or as deck Markdown,
 * check it with `@texuli/deck` at the `untrusted` tier, and paint it on the
 * real slides stage. Nothing leaves the browser.
 *
 * Invalid input never paints. Any error (in the text, or from the stage's
 * own second check) CLEARS the preview with a visible message instead of
 * leaving a stale deck next to new text. Diagnostics list the code, the
 * message, the JSON path and the line and column, and "Go to" moves the
 * caret there. "Convert" turns a valid deck into the other format through
 * the engine (`writeDeckMarkdown`, or the validated JSON).
 *
 * The engine, the seeds and the stage load after the island mounts, so the
 * first paint is only this shell. The embedded stage never claims the page
 * hash.
 */
import type { Component } from 'svelte';
import { Button } from 'texuli/button';
import type * as Checks from './check.ts';
import {
  type DeckCheck,
  EDITOR_TABS,
  type EditorDiagnostic,
  type EditorPhase,
  type EditorTab,
  errorCount,
  INPUT_DEBOUNCE_MS,
  lineCount,
  offsetOf,
  phaseOf,
  positionText,
  statusText,
  toEditorDiagnostics,
} from './model.ts';
import type * as Seeds from './seeds.ts';

interface Props {
  /** The starter example shown first (a template id). Default `pitch`. */
  seed?: string;
  /** The tab shown first. Default `json`. */
  initialTab?: EditorTab;
}

type StageIssue = {
  code: string;
  message: string;
  jsonPath: string;
  severity: 'error' | 'warning';
};
type PreviewProps = { deck: unknown; onError: (issues: readonly StageIssue[]) => void };

let { seed: initialSeed = 'pitch', initialTab = 'json' }: Props = $props();

const LABELS: Readonly<Record<EditorTab, string>> = { json: 'JSON', markdown: 'Markdown' };

// svelte-ignore state_referenced_locally
let tab = $state<EditorTab>(initialTab);
let texts = $state<Record<EditorTab, string>>({ json: '', markdown: '' });
// svelte-ignore state_referenced_locally
let seedId = $state(initialSeed);
/** Bumped by a seed change, a conversion or a tab switch: the next check runs at once. */
let revision = $state(0);

let checks = $state<typeof Checks | null>(null);
let seeds = $state<typeof Seeds | null>(null);
let Preview = $state<Component<PreviewProps> | null>(null);
let loadFailed = $state(false);

let check = $state<DeckCheck | null>(null);
/** Bumped on every finished check, so the stage restarts with the new deck. */
let painted = $state(0);
let stageIssues = $state<readonly StageIssue[]>([]);
let convertNote = $state('');

const textareas: Partial<Record<EditorTab, HTMLTextAreaElement>> = {};
const tabButtons: Partial<Record<EditorTab, HTMLButtonElement>> = {};

const seedInfo = $derived(seeds?.seedById(seedId));
const stageDiagnostics = $derived<EditorDiagnostic[]>(
  toEditorDiagnostics(stageIssues).map((diagnostic) => ({
    ...diagnostic,
    key: `stage:${diagnostic.key}`,
  }))
);
const diagnostics = $derived<EditorDiagnostic[]>([
  ...(check?.diagnostics ?? []),
  ...stageDiagnostics,
]);
const stageRefused = $derived(errorCount(stageDiagnostics) > 0);
const phase = $derived<EditorPhase>(
  loadFailed
    ? { kind: 'failed' }
    : check !== null && stageRefused
      ? { kind: 'refused', errors: errorCount(diagnostics) }
      : phaseOf(check)
);
const status = $derived(statusText(phase, tab));
const canConvert = $derived(check?.ok === true && !stageRefused);
const lines = $derived(lineCount(texts[tab]));

// Load the engine checks, the seeds and the stage once the island is on screen.
$effect(() => {
  let live = true;
  Promise.all([import('./check.ts'), import('./seeds.ts'), import('./PreviewStage.svelte')]).then(
    ([checkModule, seedModule, preview]) => {
      if (!live) return;
      checks = checkModule;
      seeds = seedModule;
      Preview = preview.default as unknown as Component<PreviewProps>;
      const first = seedModule.seedById(seedId) ?? seedModule.seedById(seedModule.DEFAULT_SEED_ID);
      if (first) applySeed(seedModule, first.id);
    },
    () => {
      if (live) loadFailed = true;
    }
  );
  return () => {
    live = false;
  };
});

// Check after typing pauses; a new revision (seed, conversion, tab) checks at once.
let lastRevision = -1;
$effect(() => {
  const run = checks;
  const current = tab;
  const source = texts[current];
  const rev = revision;
  if (!run || (source === '' && seeds === null)) return;
  const apply = () => {
    stageIssues = [];
    check = current === 'json' ? run.checkDeckJson(source) : run.checkDeckMarkdown(source);
    painted += 1;
  };
  if (rev !== lastRevision) {
    lastRevision = rev;
    apply();
    return;
  }
  check = null;
  const timer = setTimeout(apply, INPUT_DEBOUNCE_MS);
  return () => clearTimeout(timer);
});

function applySeed(module: typeof Seeds, id: string) {
  const next = module.seedById(id);
  if (!next) return;
  seedId = id;
  convertNote = '';
  if (id === module.BROKEN_JSON_ID) {
    texts.json = module.seedText(next, 'json');
    tab = 'json';
  } else if (id === module.BROKEN_MARKDOWN_ID) {
    texts.markdown = module.seedText(next, 'markdown');
    tab = 'markdown';
  } else {
    texts = { json: module.seedText(next, 'json'), markdown: module.seedText(next, 'markdown') };
  }
  revision += 1;
}

function chooseSeed(id: string) {
  if (seeds) applySeed(seeds, id);
}

function selectTab(next: EditorTab, focus = false) {
  if (next !== tab) {
    tab = next;
    convertNote = '';
    revision += 1;
  }
  if (focus) tabButtons[next]?.focus();
}

function onTabKeydown(event: KeyboardEvent) {
  const index = EDITOR_TABS.indexOf(tab);
  let next: EditorTab | undefined;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
    next = EDITOR_TABS[(index + 1) % EDITOR_TABS.length];
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
    next = EDITOR_TABS[(index - 1 + EDITOR_TABS.length) % EDITOR_TABS.length];
  else if (event.key === 'Home') next = EDITOR_TABS[0];
  else if (event.key === 'End') next = EDITOR_TABS[EDITOR_TABS.length - 1];
  if (!next) return;
  event.preventDefault();
  selectTab(next, true);
}

function convert() {
  if (!checks || !check?.ok || check.deck === undefined) return;
  if (tab === 'json') {
    const written = checks.deckAsMarkdown(check.deck);
    texts.markdown = written.markdown;
    convertNote =
      written.warnings.length > 0
        ? `Converted to Markdown with ${written.warnings.length === 1 ? 'one note' : `${written.warnings.length} notes`}: ${written.warnings.join(' ')}`
        : 'Converted to Markdown.';
    tab = 'markdown';
  } else {
    texts.json = checks.deckAsJson(check.deck);
    convertNote = 'Converted to JSON.';
    tab = 'json';
  }
  revision += 1;
  tabButtons[tab]?.focus();
}

function goTo(diagnostic: EditorDiagnostic) {
  const area = textareas[tab];
  if (!area || diagnostic.line === undefined) return;
  const offset = offsetOf(texts[tab], diagnostic.line, diagnostic.column ?? 1);
  area.focus();
  area.setSelectionRange(offset, offset);
}

function onStageError(issues: readonly StageIssue[]) {
  stageIssues = issues.filter((issue) => issue.severity === 'error').slice(0, 50);
}
</script>

<div class="deck-editor" data-deck-editor>
  <section class="deck-editor__pane" aria-labelledby="deck-editor-heading">
    <h2 id="deck-editor-heading">Deck source</h2>

    <div class="deck-editor__field">
      <label for="deck-editor-seed">Example</label>
      <select
        id="deck-editor-seed"
        value={seedId}
        disabled={seeds === null}
        aria-describedby="deck-editor-seed-summary"
        onchange={(event) => chooseSeed(event.currentTarget.value)}
        data-deck-editor-seed
      >
        {#if seeds}
          {#each seeds.EDITOR_SEEDS as option (option.id)}
            <option value={option.id}>{option.label}</option>
          {/each}
        {:else}
          <option value={seedId}>Loading the examples…</option>
        {/if}
      </select>
      <p id="deck-editor-seed-summary" class="deck-editor__hint">{seedInfo?.summary ?? ''}</p>
    </div>

    <div class="deck-editor__tabs" role="tablist" aria-label="Deck format">
      {#each EDITOR_TABS as id (id)}
        <button
          type="button"
          role="tab"
          id={`deck-editor-tab-${id}`}
          aria-selected={tab === id}
          aria-controls={`deck-editor-panel-${id}`}
          tabindex={tab === id ? 0 : -1}
          class="deck-editor__tab"
          bind:this={tabButtons[id]}
          onclick={() => selectTab(id)}
          onkeydown={onTabKeydown}
          data-deck-editor-tab={id}
        >
          {LABELS[id]}
        </button>
      {/each}
    </div>

    {#each EDITOR_TABS as id (id)}
      <div
        class="deck-editor__panel"
        role="tabpanel"
        id={`deck-editor-panel-${id}`}
        aria-labelledby={`deck-editor-tab-${id}`}
        hidden={tab !== id}
      >
        <div class="deck-editor__label-row">
          <label for={`deck-editor-text-${id}`}>Deck {LABELS[id]}</label>
          <span id={`deck-editor-lines-${id}`} class="deck-editor__hint">
            {tab === id ? (lines === 1 ? '1 line' : `${lines} lines`) : ''}
          </span>
        </div>
        <textarea
          id={`deck-editor-text-${id}`}
          class="deck-editor__text"
          bind:value={texts[id]}
          bind:this={textareas[id]}
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          rows="22"
          aria-describedby={`deck-editor-lines-${id} deck-editor-keys`}
          data-deck-editor-input={id}
        ></textarea>
      </div>
    {/each}
    <p id="deck-editor-keys" class="deck-editor__hint">
      Changes are checked {INPUT_DEBOUNCE_MS} ms after you stop typing. Tab leaves the editor;
      arrow keys switch between the JSON and Markdown tabs.
    </p>

    <div class="deck-editor__actions">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canConvert}
        onclick={convert}
        data-deck-editor-convert
      >
        {tab === 'json' ? 'Convert to Markdown' : 'Convert to JSON'}
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={seeds === null} onclick={() => chooseSeed(seedId)}>
        Reset example
      </Button>
    </div>
    <p class="deck-editor__hint" aria-live="polite" data-deck-editor-convert-note>{convertNote}</p>
  </section>

  <section class="deck-editor__pane" aria-labelledby="deck-editor-result-heading">
    <h2 id="deck-editor-result-heading">Result</h2>
    <p
      class="deck-editor__status"
      role="status"
      aria-live="polite"
      data-deck-editor-status
      data-phase={phase.kind}
    >
      {status}
    </p>

    <section class="deck-editor__diagnostics" aria-labelledby="deck-editor-diagnostics-heading">
      <h3 id="deck-editor-diagnostics-heading">Diagnostics</h3>
      {#if diagnostics.length === 0}
        <p class="deck-editor__hint">{check ? 'No diagnostics.' : 'Checking…'}</p>
      {:else}
        <ul class="deck-editor__list" aria-labelledby="deck-editor-diagnostics-heading" data-deck-editor-diagnostics>
          {#each diagnostics as diagnostic (diagnostic.key)}
            <li
              class="deck-editor__item"
              data-severity={diagnostic.severity}
              data-code={diagnostic.code}
              data-json-path={diagnostic.jsonPath}
              data-line={diagnostic.line}
              data-column={diagnostic.column}
            >
              <span class="deck-editor__severity">{diagnostic.severity === 'error' ? 'Error' : 'Warning'}</span>
              <code class="deck-editor__code">{diagnostic.code}</code>
              <span class="deck-editor__message">{diagnostic.message}</span>
              <span class="deck-editor__where">
                <span class="deck-editor__sr">at </span><code>{diagnostic.jsonPath}</code>
                {#if diagnostic.line !== undefined}
                  <span>, {positionText(diagnostic)}</span>
                  <button
                    type="button"
                    class="deck-editor__goto"
                    onclick={() => goTo(diagnostic)}
                    aria-label={`Go to ${positionText(diagnostic)}`}
                  >
                    Go to
                  </button>
                {/if}
              </span>
              {#if diagnostic.fix}<span class="deck-editor__fix">{diagnostic.fix}</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="deck-editor__stage-wrap" aria-labelledby="deck-editor-stage-heading">
      <h3 id="deck-editor-stage-heading">Rendered deck</h3>
      <div class="deck-editor__stage" data-deck-editor-preview>
        {#if phase.kind === 'painted' && Preview && check?.deck !== undefined}
          {#key painted}
            <Preview deck={check.deck} onError={onStageError} />
          {/key}
        {:else if phase.kind === 'refused'}
          <p class="deck-editor__empty" data-deck-editor-cleared>
            The preview was cleared: nothing is rendered until the deck passes validation.
          </p>
        {:else if phase.kind === 'failed'}
          <p class="deck-editor__empty">The deck engine could not be loaded.</p>
        {:else}
          <p class="deck-editor__empty">{Preview ? 'Checking the deck…' : 'Loading the stage…'}</p>
        {/if}
      </div>
    </section>
  </section>
</div>

<style>
  .deck-editor {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }
  @media (min-width: 64rem) {
    .deck-editor {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
      align-items: start;
    }
  }
  .deck-editor__pane {
    display: grid;
    gap: 0.75rem;
    min-inline-size: 0;
    padding: 1rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-card, Canvas);
    color: var(--tx-card-foreground, CanvasText);
  }
  h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  h3 {
    margin: 0 0 0.4rem;
    font-size: 0.95rem;
  }
  .deck-editor__field,
  .deck-editor__panel {
    display: grid;
    gap: 0.35rem;
  }
  .deck-editor__panel[hidden] {
    display: none;
  }
  .deck-editor__label-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }
  label {
    font-weight: 600;
    font-size: 0.9rem;
  }
  select,
  .deck-editor__text {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--tx-input, ButtonBorder);
    border-radius: var(--tx-radius, 0.375rem);
    background: var(--tx-background, Field);
    color: var(--tx-foreground, FieldText);
    font: inherit;
  }
  .deck-editor__text {
    min-block-size: 18rem;
    resize: vertical;
    font-family: var(--tx-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.8125rem;
    line-height: 1.5;
    tab-size: 2;
    white-space: pre;
    overflow: auto;
  }
  .deck-editor__tabs {
    display: flex;
    gap: 0.25rem;
    border-block-end: 1px solid var(--tx-border, CanvasText);
  }
  .deck-editor__tab {
    min-block-size: 2.75rem;
    min-inline-size: 2.75rem;
    padding: 0.4rem 0.9rem;
    border: 1px solid transparent;
    border-block-end: 0;
    border-start-start-radius: var(--tx-radius, 0.375rem);
    border-start-end-radius: var(--tx-radius, 0.375rem);
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .deck-editor__tab[aria-selected='true'] {
    border-color: var(--tx-border, CanvasText);
    background: var(--tx-background, Canvas);
    box-shadow: inset 0 -0.2rem 0 var(--tx-primary, Highlight);
  }
  select:focus-visible,
  .deck-editor__text:focus-visible,
  .deck-editor__tab:focus-visible,
  .deck-editor__goto:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .deck-editor__hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .deck-editor__hint:empty {
    display: none;
  }
  .deck-editor__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .deck-editor__status {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-inline-start: 0.25rem solid var(--tx-border, CanvasText);
    font-weight: 600;
  }
  .deck-editor__status[data-phase='painted'] {
    border-inline-start-color: var(--tx-success, var(--tx-primary, CanvasText));
  }
  .deck-editor__status[data-phase='refused'],
  .deck-editor__status[data-phase='failed'] {
    border-inline-start-color: var(--tx-destructive, CanvasText);
  }
  .deck-editor__list {
    display: grid;
    gap: 0.4rem;
    max-block-size: 18rem;
    margin: 0;
    padding: 0;
    overflow: auto;
    list-style: none;
  }
  .deck-editor__item {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
    padding: 0.45rem 0.6rem;
    border-inline-start: 0.25rem solid var(--tx-destructive, CanvasText);
    background: var(--tx-muted, transparent);
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }
  .deck-editor__item[data-severity='warning'] {
    border-inline-start-color: var(--tx-warning, CanvasText);
  }
  .deck-editor__severity {
    font-weight: 600;
  }
  .deck-editor__code,
  .deck-editor__where code {
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.8rem;
  }
  .deck-editor__message {
    flex: 1 1 12rem;
  }
  .deck-editor__where,
  .deck-editor__fix {
    flex-basis: 100%;
    color: var(--tx-muted-foreground, GrayText);
  }
  .deck-editor__goto {
    min-block-size: 1.5rem;
    margin-inline-start: 0.5rem;
    padding: 0 0.5rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.25rem);
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .deck-editor__sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .deck-editor__stage {
    position: relative;
    min-block-size: 12rem;
    aspect-ratio: 16 / 9;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: var(--tx-radius, 0.375rem);
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
    overflow: hidden;
    contain: layout paint;
  }
  .deck-editor__empty {
    margin: 0;
    padding: 0.75rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  @media (forced-colors: active) {
    .deck-editor__item,
    .deck-editor__status {
      border-inline-start-color: CanvasText;
    }
    .deck-editor__tab[aria-selected='true'] {
      box-shadow: none;
      border-block-end: 3px solid Highlight;
    }
  }
</style>
