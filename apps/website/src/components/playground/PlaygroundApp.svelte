<script lang="ts">
import type { RenderNode } from '@texuli/catalog/render/renderer';
import { Button } from 'texuli/button';
import { type ToolShortcutMap, toolShortcut } from '../tool-keys.ts';
import { defaultEditorJson, PLAYGROUND_PRESETS, presetById } from './presets.ts';
import { formatDiagnostics, type PlaygroundRunOk, runPlaygroundTree } from './run.ts';
import TreePreview from './TreePreview.svelte';

/**
 * Agent playground island: edit catalog JSON, pick hostile/safe presets,
 * run the sink-free renderer, show diagnostics and an inert tree preview.
 */

let source = $state(defaultEditorJson());
let presetId = $state('safe-card');
let parseError = $state<string | null>(null);
let run = $state<PlaygroundRunOk | null>(null);
let roots = $state<readonly RenderNode[]>([]);
let diagnosticLines = $state<string[]>([]);
let keysOpen = $state(false);

const groups = $derived.by(() => {
  const map = new Map<string, typeof PLAYGROUND_PRESETS>();
  for (const preset of PLAYGROUND_PRESETS) {
    const list = map.get(preset.group) ?? [];
    list.push(preset);
    map.set(preset.group, list);
  }
  return [...map.entries()];
});

function applyPreset(id: string): void {
  const preset = presetById(id);
  if (!preset) return;
  presetId = id;
  source = `${JSON.stringify(preset.tree, null, 2)}\n`;
  parseError = null;
  run = null;
  roots = [];
  diagnosticLines = [];
}

/** A preset card: load the sample and run it, so the caption's proof is instant. */
function pickPreset(id: string): void {
  applyPreset(id);
  render();
}

function render(): void {
  const result = runPlaygroundTree(source);
  if (!result.ok) {
    parseError = result.error.message;
    run = null;
    roots = [];
    diagnosticLines = [];
    return;
  }
  parseError = null;
  run = result;
  roots = result.roots;
  diagnosticLines = formatDiagnostics(result);
}

function onPresetChange(event: Event): void {
  const value = (event.currentTarget as HTMLSelectElement).value;
  applyPreset(value);
}

/* ── Keyboard map (punch-list row 4) ──────────────────────────────────── */

const PLAYGROUND_KEYS: ToolShortcutMap = { r: 'render', '?': 'keys' };

function onPlaygroundKey(event: KeyboardEvent): void {
  const action = toolShortcut(event, event.target, PLAYGROUND_KEYS);
  if (!action) return;
  if (action === 'keys') keysOpen = !keysOpen;
  else if (action === 'render') render();
}
</script>

<svelte:window onkeydown={onPlaygroundKey} />

<div class="playground" data-tx-playground="">
  <section class="playground__presets" aria-labelledby="playground-presets-heading">
    <h2 id="playground-presets-heading">Presets, and what each one proves</h2>
    <p class="playground__presets-lead">
      Every card loads its sample into the editor and runs it once. The hostile cards are the
      corpus an agent host should expect; each caption states the property the neutralized output
      demonstrates.
    </p>
    <div class="presets" role="group" aria-label="Presets">
      {#each PLAYGROUND_PRESETS as preset (preset.id)}
        <button
          type="button"
          class="preset"
          class:preset--active={preset.id === presetId}
          aria-pressed={preset.id === presetId}
          data-tx-playground-preset={preset.id}
          onclick={() => pickPreset(preset.id)}
        >
          <span class="preset__group" data-group={preset.group}>{preset.group}</span>
          <span class="preset__label">{preset.label}</span>
          <span class="preset__proves">{preset.proves}</span>
        </button>
      {/each}
    </div>
  </section>

  <div class="playground__grid">
    <div class="playground__controls">
    <label class="field">
      <span class="field__label">Preset</span>
      <select class="field__control" aria-label="Preset" value={presetId} onchange={onPresetChange}>
        {#each groups as [group, presets] (group)}
          <optgroup label={group}>
            {#each presets as preset (preset.id)}
              <option value={preset.id}>{preset.label}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
    <p class="hint" data-tx-playground-preset-desc="">
      {presetById(presetId)?.description ?? ''}
    </p>
    <label class="field field--editor">
      <span class="field__label">Catalog tree (JSON)</span>
      <textarea
        class="field__control field__textarea"
        aria-label="Catalog tree JSON"
        spellcheck="false"
        rows="16"
        bind:value={source}
      ></textarea>
    </label>
    <div class="playground__actions">
      <Button type="button" variant="default" onclick={render}>Render tree</Button>
      <Button type="button" variant="outline" onclick={() => applyPreset(presetId)}>Reset preset</Button>
    </div>
    {#if parseError}
      <p class="error" role="alert" data-tx-playground-parse-error="">{parseError}</p>
    {/if}
    <details class="keys" data-tx-playground-keys bind:open={keysOpen}>
      <summary>Keyboard</summary>
      <p class="hint">
        The editor, select and buttons are ordinary controls: Tab moves between them and arrow keys
        work inside the select. These shortcuts do not fire while you type in the editor.
      </p>
      <ul class="keys__list">
        <li><kbd>R</kbd> run the tree in the editor</li>
        <li><kbd>?</kbd> show or hide this list</li>
      </ul>
    </details>
  </div>

  <div class="playground__output">
    <section class="panel" aria-labelledby="playground-preview-title">
      <h2 id="playground-preview-title">Sink-free preview</h2>
      <p class="panel__lead">
        Output is plain data from the catalog renderer: components keep only sanitized props;
        unknown or tier-denied ids become placeholders. Nothing is executed as HTML.
      </p>
      <TreePreview {roots} />
    </section>

    <section class="panel" aria-labelledby="playground-diag-title">
      <h2 id="playground-diag-title">Validation</h2>
      {#if !run && !parseError}
        <p class="panel__lead" role="status">Run Render tree to see diagnostics.</p>
      {:else if diagnosticLines.length === 0}
        <p class="ok" role="status" data-tx-playground-ok="">No diagnostics. The tree is clean under the untrusted tier.</p>
      {:else}
        <ul class="diag" data-tx-playground-diagnostics="">
          {#each diagnosticLines as line, i (i)}
            <li>{line}</li>
          {/each}
        </ul>
      {/if}
      {#if run}
        <p class="meta" data-tx-playground-meta="">
          Roots: {run.roots.length} · Diagnostics: {run.diagnostics.length}
          {run.overLimits ? ' · over tree limits' : ''}
        </p>
      {/if}
    </section>
  </div>
  </div>
</div>

<style>
  .playground {
    display: grid;
    gap: 1.5rem;
  }
  /* Grid items must shrink below their content's min-content: a select's
     intrinsic width is its widest option label, which would otherwise size
     every ancestor track past the viewport on small screens. */
  .playground,
  .playground__grid,
  .playground__controls,
  .playground__output,
  .field {
    min-inline-size: 0;
  }
  .playground__presets {
    display: grid;
    gap: 0.6rem;
    min-inline-size: 0;
  }
  .playground__presets h2 {
    margin: 0;
    font-size: 1.125rem;
    color: var(--tx-foreground);
  }
  .playground__presets-lead {
    margin: 0;
    font-size: 0.9375rem;
    max-inline-size: 46rem;
    color: var(--tx-foreground);
  }
  .presets {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(15rem, 18rem);
    gap: 0.6rem;
    overflow-x: auto;
    padding-block-end: 0.35rem;
  }
  .preset {
    display: grid;
    gap: 0.25rem;
    align-content: start;
    padding: 0.6rem 0.7rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    font: inherit;
    text-align: start;
    cursor: pointer;
    min-inline-size: 0;
  }
  .preset:hover {
    background: var(--tx-muted, var(--tx-background));
  }
  .preset--active {
    border-color: var(--tx-ring);
    box-shadow: inset 0 0 0 1px var(--tx-ring);
  }
  .preset:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .preset__group {
    justify-self: start;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    border: 1px solid var(--tx-border);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .preset__group[data-group='safe'] {
    border-color: var(--tx-success, var(--tx-border));
  }
  .preset__label {
    font-weight: 600;
    font-size: 0.9375rem;
    overflow-wrap: anywhere;
  }
  .preset__proves {
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
  }
  @media (min-width: 64rem) {
    .playground__grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .playground__controls,
  .playground__output {
    display: grid;
    gap: 1rem;
  }
  .field {
    display: grid;
    gap: 0.35rem;
  }
  .field__label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--tx-foreground);
  }
  .field__control {
    min-block-size: 2.75rem;
    min-inline-size: 0;
    max-inline-size: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    font: inherit;
  }
  .field__control:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .field__textarea {
    min-block-size: 18rem;
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.8125rem;
    line-height: 1.45;
    resize: vertical;
  }
  .hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--tx-foreground);
  }
  .playground__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .error {
    margin: 0;
    padding: 0.65rem 0.75rem;
    border: 2px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    font-weight: 600;
  }
  .panel {
    display: grid;
    gap: 0.65rem;
    padding: 1rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, var(--tx-background));
    color: var(--tx-foreground);
  }
  .panel h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  .panel__lead,
  .ok,
  .meta {
    margin: 0;
    font-size: 0.875rem;
  }
  .ok {
    font-weight: 600;
  }
  .diag {
    margin: 0;
    padding-inline-start: 1.25rem;
    display: grid;
    gap: 0.35rem;
    font-size: 0.875rem;
  }
  .keys {
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    padding: 0.65rem 0.75rem;
  }
  .keys summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--tx-foreground);
  }
  .keys__list {
    margin: 0.5rem 0 0;
    padding-inline-start: 1.25rem;
    display: grid;
    gap: 0.3rem;
    font-size: 0.875rem;
  }
  .keys kbd {
    padding: 0.05rem 0.35rem;
    border: 1px solid var(--tx-border);
    border-radius: 0.25rem;
    background: var(--tx-background);
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.8125rem;
  }
  @media (forced-colors: active) {
    .field__control,
    .panel,
    .error,
    .preset,
    .keys,
    .keys kbd {
      border-color: ButtonText;
      forced-color-adjust: none;
    }
    .preset--active {
      border-color: Highlight;
    }
  }
</style>
