<script lang="ts">
import type { RenderNode } from '@texuli/catalog/render/renderer';
import { Button } from 'texuli/button';
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
</script>

<div class="playground" data-tx-playground="">
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

<style>
  .playground {
    display: grid;
    gap: 1.5rem;
  }
  /* Grid items must shrink below their content's min-content: a select's
     intrinsic width is its widest option label, which would otherwise size
     every ancestor track past the viewport on small screens. */
  .playground,
  .playground__controls,
  .playground__output,
  .field {
    min-inline-size: 0;
  }
  @media (min-width: 64rem) {
    .playground {
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
  @media (forced-colors: active) {
    .field__control,
    .panel,
    .error {
      border-color: ButtonText;
      forced-color-adjust: none;
    }
  }
</style>
