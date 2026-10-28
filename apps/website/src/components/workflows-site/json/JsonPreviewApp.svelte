<script lang="ts">
/**
 * JSON live preview: edit a blueprint, validate it, paint it with the real
 * player at the `untrusted` tier. Nothing leaves the browser.
 *
 * Invalid input never paints. On a parse error or any error diagnostic the
 * preview is CLEARED (the player is unmounted), not kept as a stale render:
 * a page that shows an old result next to new text invites a wrong reading,
 * and clearing leaves nothing painted from text that failed the check.
 *
 * The validator and the player load lazily, after the island mounts, so
 * the first load is only this shell.
 */
import type { PlayerDiagnosticsEvent, PlayerNodeError } from '@texuli/player';
import type { Component } from 'svelte';
import { Button } from 'texuli/button';
import {
  dedupe,
  errorCount,
  INPUT_DEBOUNCE_MS,
  lineCount,
  type PreviewDiagnostic,
  type PreviewPhase,
  parseJsonText,
  statusText,
} from './model.ts';
import { playerDiagnostics, playerRefused } from './player-issues.ts';
import { DEFAULT_SEED_ID, JSON_SEEDS, seedById, seedText } from './seeds.ts';
import type { BlueprintCheck } from './validate.ts';

type CheckFn = (text: string) => BlueprintCheck;
type PreviewProps = {
  blueprint: unknown;
  onDiagnostics: (event: PlayerDiagnosticsEvent) => void;
  onNodeError: (error: PlayerNodeError) => void;
};

const initialSeed = seedById(DEFAULT_SEED_ID) ?? JSON_SEEDS[0];

let seedId = $state(initialSeed?.id ?? '');
let text = $state(initialSeed ? seedText(initialSeed) : '');
/** Bumped on every seed change or reset, so the player starts fresh. */
let revision = $state(0);
let checkText = $state<CheckFn | null>(null);
let Preview = $state<Component<PreviewProps> | null>(null);
let loadFailed = $state(false);
let check = $state<BlueprintCheck | null>(null);
let playerEvent = $state<PlayerDiagnosticsEvent | null>(null);
let nodeErrors = $state<PlayerNodeError[]>([]);

const seed = $derived(seedById(seedId));
const lines = $derived(lineCount(text));
const painting = $derived(check?.ok === true);
const diagnostics = $derived<PreviewDiagnostic[]>(
  check
    ? dedupe([
        ...check.diagnostics,
        ...(painting && check.root ? playerDiagnostics(playerEvent, nodeErrors, check.root) : []),
      ])
    : []
);
const errors = $derived(errorCount(diagnostics));
const phase = $derived<PreviewPhase>(
  check === null
    ? { kind: 'checking' }
    : errors > 0 || playerRefused(playerEvent)
      ? { kind: 'refused', errors: Math.max(errors, 1) }
      : { kind: 'painted', warnings: diagnostics.length - errors }
);
const status = $derived(loadFailed ? 'The validator could not be loaded.' : statusText(phase));

// Load the validator and the player once the island is on screen.
$effect(() => {
  let live = true;
  Promise.all([import('./validate.ts'), import('./PreviewPlayer.svelte')]).then(
    ([validator, preview]) => {
      if (!live) return;
      checkText = validator.checkBlueprintText;
      Preview = preview.default as Component<PreviewProps>;
    },
    () => {
      if (live) loadFailed = true;
    }
  );
  return () => {
    live = false;
  };
});

// Validate after typing pauses; the first check (and a seed change) runs at once.
let lastRevision = -1;
$effect(() => {
  const run = checkText;
  const source = text;
  const current = revision;
  if (!run) return;
  const apply = () => {
    const next = run(source);
    // Only a new blueprint resets the player's report; the player reports again on paint.
    playerEvent = null;
    nodeErrors = [];
    check = next;
  };
  if (current !== lastRevision) {
    lastRevision = current;
    apply();
    return;
  }
  const timer = setTimeout(apply, INPUT_DEBOUNCE_MS);
  return () => clearTimeout(timer);
});

function chooseSeed(id: string) {
  const next = seedById(id);
  if (!next) return;
  seedId = id;
  text = seedText(next);
  revision += 1;
}

function resetSeed() {
  if (seed) chooseSeed(seed.id);
}

function formatJson() {
  const parsed = parseJsonText(text);
  if (parsed.ok) text = `${JSON.stringify(parsed.value, null, 2)}\n`;
}

function onDiagnostics(event: PlayerDiagnosticsEvent) {
  playerEvent = event;
  nodeErrors = [];
}

function onNodeError(error: PlayerNodeError) {
  nodeErrors = [...nodeErrors, error];
}
</script>

<div class="json-preview" data-json-preview>
  <section class="json-preview__pane" aria-labelledby="json-preview-editor-heading">
    <h2 id="json-preview-editor-heading">Blueprint</h2>
    <div class="json-preview__field">
      <label for="json-preview-seed">Example</label>
      <select
        id="json-preview-seed"
        value={seedId}
        aria-describedby="json-preview-seed-summary"
        onchange={(event) => chooseSeed(event.currentTarget.value)}
        data-json-preview-seed
      >
        {#each JSON_SEEDS as option (option.id)}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
      <p id="json-preview-seed-summary" class="json-preview__hint">{seed?.summary ?? ''}</p>
    </div>
    <div class="json-preview__field">
      <div class="json-preview__label-row">
        <label for="json-preview-text">Blueprint JSON</label>
        <span id="json-preview-lines" class="json-preview__hint" data-json-preview-lines>
          {lines === 1 ? '1 line' : `${lines} lines`}
        </span>
      </div>
      <textarea
        id="json-preview-text"
        class="json-preview__text"
        bind:value={text}
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        rows="24"
        aria-describedby="json-preview-lines json-preview-keys"
        data-json-preview-text
      ></textarea>
      <p id="json-preview-keys" class="json-preview__hint">
        Changes are checked {INPUT_DEBOUNCE_MS} ms after you stop typing. Tab leaves the editor.
      </p>
    </div>
    <div class="json-preview__actions">
      <Button type="button" variant="outline" size="sm" onclick={formatJson}>Format JSON</Button>
      <Button type="button" variant="outline" size="sm" onclick={resetSeed}>Reset example</Button>
    </div>
  </section>

  <section class="json-preview__pane" aria-labelledby="json-preview-result-heading">
    <h2 id="json-preview-result-heading">Result</h2>
    <p
      class="json-preview__status"
      role="status"
      aria-live="polite"
      data-json-preview-status
      data-phase={loadFailed ? 'failed' : phase.kind}
    >
      {status}
    </p>

    <section class="json-preview__diagnostics" aria-labelledby="json-preview-diagnostics-heading">
      <h3 id="json-preview-diagnostics-heading">Diagnostics</h3>
      {#if diagnostics.length === 0}
        <p class="json-preview__hint">
          {check ? 'No diagnostics.' : 'The validator is loading…'}
        </p>
      {:else}
        <ul class="json-preview__list" aria-labelledby="json-preview-diagnostics-heading" data-json-preview-diagnostics>
          {#each diagnostics as diagnostic (diagnostic.key)}
            <li class="json-preview__item" data-severity={diagnostic.severity} data-code={diagnostic.code}>
              <span class="json-preview__severity">
                {diagnostic.severity === 'error' ? 'Error' : 'Warning'}
              </span>
              <code class="json-preview__code">{diagnostic.code}</code>
              <span class="json-preview__message">{diagnostic.message}</span>
              <span class="json-preview__path">
                <span class="json-preview__sr">at </span><code>{diagnostic.path}</code>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="json-preview__stage-wrap" aria-labelledby="json-preview-stage-heading">
      <h3 id="json-preview-stage-heading">Rendered preview</h3>
      <div class="json-preview__stage" data-json-preview-stage>
        {#if painting && Preview && check}
          {#key revision}
            <Preview blueprint={check.value} {onDiagnostics} {onNodeError} />
          {/key}
        {:else if check}
          <p class="json-preview__empty" data-json-preview-cleared>
            Nothing is rendered until the blueprint passes validation.
          </p>
        {:else}
          <p class="json-preview__empty">Loading the player…</p>
        {/if}
      </div>
    </section>
  </section>
</div>

<style>
  .json-preview {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }
  @media (min-width: 60rem) {
    .json-preview {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .json-preview__pane {
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
  .json-preview__field {
    display: grid;
    gap: 0.35rem;
  }
  .json-preview__label-row {
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
  .json-preview__text {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--tx-input, ButtonBorder);
    border-radius: var(--tx-radius, 0.375rem);
    background: var(--tx-background, Field);
    color: var(--tx-foreground, FieldText);
    font: inherit;
  }
  .json-preview__text {
    min-block-size: 18rem;
    resize: vertical;
    font-family: var(--tx-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.8125rem;
    line-height: 1.5;
    tab-size: 2;
    white-space: pre;
    overflow: auto;
  }
  select:focus-visible,
  .json-preview__text:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .json-preview__hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .json-preview__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .json-preview__status {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-inline-start: 0.25rem solid var(--tx-border, CanvasText);
    font-weight: 600;
  }
  .json-preview__status[data-phase='painted'] {
    border-inline-start-color: var(--tx-success, var(--tx-primary, CanvasText));
  }
  .json-preview__status[data-phase='refused'],
  .json-preview__status[data-phase='failed'] {
    border-inline-start-color: var(--tx-destructive, CanvasText);
  }
  .json-preview__list {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .json-preview__item {
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
  .json-preview__item[data-severity='warning'] {
    border-inline-start-color: var(--tx-warning, CanvasText);
  }
  .json-preview__severity {
    font-weight: 600;
  }
  .json-preview__code {
    font-family: var(--tx-font-mono, ui-monospace, monospace);
  }
  .json-preview__message {
    flex: 1 1 12rem;
  }
  .json-preview__path {
    flex-basis: 100%;
    color: var(--tx-muted-foreground, GrayText);
  }
  .json-preview__path code {
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.8rem;
  }
  .json-preview__sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .json-preview__stage {
    min-block-size: 8rem;
    padding: 0.75rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: var(--tx-radius, 0.375rem);
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
    overflow: auto;
    contain: layout paint;
  }
  .json-preview__empty {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
  }
  @media (forced-colors: active) {
    .json-preview__item,
    .json-preview__status {
      border-inline-start-color: CanvasText;
    }
  }
</style>
