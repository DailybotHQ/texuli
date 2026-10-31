<script lang="ts">
/**
 * The contrast report (every checked pair per mode, the solver's
 * adjustments, warnings) and the diff against the starting point. Plain
 * tables: values are text, colors are shown as text and a swatch drawn from
 * the scope's own variables, never as markup.
 */
import type { CompiledDesignSystem } from '@texuli/tokens/design-system/compile';
import { contrastSummary, type PairRow, variableLabel } from './ds-studio.ts';

type DiffLike = {
  identical: boolean;
  summary: { added: number; removed: number; changed: number; regressions: number };
  tokens: readonly {
    mode: string;
    variable: string;
    change: string;
    before?: string;
    after?: string;
  }[];
  contrast: readonly {
    mode: string;
    foreground: string;
    background: string;
    before: number;
    after: number;
    required: number;
  }[];
  defaults: readonly { component: string; key: string; before?: string; after?: string }[];
};

let {
  compiled,
  diff,
  baseLabel,
}: {
  compiled: Pick<CompiledDesignSystem, 'report' | 'accessibility'> | null;
  diff: DiffLike | null;
  baseLabel: string;
} = $props();

let reportMode = $state<'light' | 'dark'>('light');
let failingOnly = $state(false);

const contrast = $derived(
  (compiled?.report.contrast ?? {}) as Partial<Record<'light' | 'dark', PairRow[]>>
);
const summary = $derived(contrastSummary(contrast));
const rows = $derived((contrast[reportMode] ?? []).filter((row) => !failingOnly || !row.pass));
const adjustments = $derived(compiled?.report.adjustments ?? []);
const warnings = $derived(compiled?.report.warnings ?? []);
const DIFF_ROWS = 40;
</script>

<section class="panel" aria-labelledby="ds-contrast-title" data-tx-ds-contrast="">
  <h2 id="ds-contrast-title">Contrast report</h2>
  {#if !compiled}
    <p class="hint">The report appears when the design system compiles.</p>
  {:else}
    <p class="hint">
      Target: WCAG {compiled.accessibility.contrast} text ({compiled.accessibility.contrast === 'AAA'
        ? '7'
        : '4.5'}:1), 3:1 for borders, inputs and the focus ring. The compiler enforces it: a
      document that cannot meet it is refused.
    </p>
    <ul class="summary" data-tx-ds-contrast-summary="">
      {#each summary as entry (entry.mode)}
        <li>
          <strong>{entry.mode}:</strong>
          {entry.total - entry.failing} of {entry.total} pairs pass; lowest ratio {entry.lowest.toFixed(2)}:1
        </li>
      {/each}
      <li>
        <strong>Solver adjustments:</strong>
        {adjustments.length}; <strong>warnings:</strong> {warnings.length}
      </li>
    </ul>
    <div class="controls">
      <label class="inline">
        <span>Mode</span>
        <select
          class="select"
          value={reportMode}
          onchange={(event) => {
            reportMode = (event.currentTarget as HTMLSelectElement).value === 'dark' ? 'dark' : 'light';
          }}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label class="inline">
        <input type="checkbox" bind:checked={failingOnly} />
        <span>Failing pairs only</span>
      </label>
    </div>
    <div class="scroll" role="region" aria-label="Contrast pairs" tabindex="0">
      <table class="table" data-tx-ds-contrast-table="">
        <caption class="visually-hidden">Contrast pairs, {reportMode} mode</caption>
        <thead>
          <tr>
            <th scope="col">Foreground</th>
            <th scope="col">Background</th>
            <th scope="col">Kind</th>
            <th scope="col">Ratio</th>
            <th scope="col">Needs</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, index (index)}
            <tr>
              <td>{variableLabel(row.foreground)}</td>
              <td>{variableLabel(row.background)}</td>
              <td>{row.kind}</td>
              <td>{row.ratio.toFixed(2)}</td>
              <td>{row.required}</td>
              <td>{row.pass ? 'Pass' : 'Fail'}</td>
            </tr>
          {:else}
            <tr><td colspan="6">No pair fails in this mode.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if adjustments.length > 0}
      <details class="more">
        <summary>Solver adjustments ({adjustments.length})</summary>
        <ul class="list" data-tx-ds-adjustments="">
          {#each adjustments as entry, index (index)}
            <li>
              {entry.mode}: <code>{entry.variable}</code> {entry.from} → {entry.to}, because of
              <code>{entry.path}</code>. {entry.reason}
            </li>
          {/each}
        </ul>
      </details>
    {/if}
    {#if warnings.length > 0}
      <details class="more">
        <summary>Warnings ({warnings.length})</summary>
        <ul class="list">
          {#each warnings as entry, index (index)}
            <li><code>{entry.path}</code>: {entry.message}</li>
          {/each}
        </ul>
      </details>
    {/if}
  {/if}
</section>

<section class="panel" aria-labelledby="ds-diff-title" data-tx-ds-diff="">
  <h2 id="ds-diff-title">Changes from the starting point</h2>
  <p class="hint">Compared with {baseLabel}.</p>
  {#if !diff}
    <p class="hint">The diff appears once the compiler has loaded.</p>
  {:else if diff.identical}
    <p data-tx-ds-diff-summary="">No change yet: edit any section to see what moves.</p>
  {:else}
    <p data-tx-ds-diff-summary="">
      {diff.summary.changed} changed, {diff.summary.added} added and {diff.summary.removed} removed
      variables; {diff.summary.regressions} contrast regressions; {diff.defaults.length} component
      default changes.
    </p>
    {#if diff.contrast.length > 0}
      <ul class="list">
        {#each diff.contrast as entry, index (index)}
          <li>
            {entry.mode}: {variableLabel(entry.foreground)} on {variableLabel(entry.background)}
            went from {entry.before.toFixed(2)} to {entry.after.toFixed(2)} (needs {entry.required})
          </li>
        {/each}
      </ul>
    {/if}
    <details class="more">
      <summary>Changed variables ({diff.tokens.length})</summary>
      <ul class="list list--mono" data-tx-ds-diff-tokens="">
        {#each diff.tokens.slice(0, DIFF_ROWS) as entry, index (index)}
          <li>
            {entry.mode} <code>{entry.variable}</code>: {entry.before ?? '(none)'} → {entry.after ?? '(none)'}
          </li>
        {/each}
      </ul>
      {#if diff.tokens.length > DIFF_ROWS}
        <p class="hint">
          And {diff.tokens.length - DIFF_ROWS} more; the compiled JSON export holds every value.
        </p>
      {/if}
    </details>
  {/if}
</section>

<style>
  .panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, var(--tx-background));
    color: var(--tx-foreground);
  }
  h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  .hint {
    margin: 0;
    font-size: 0.875rem;
  }
  .summary,
  .list {
    margin: 0;
    padding-inline-start: 1.25rem;
    display: grid;
    gap: 0.25rem;
    font-size: 0.875rem;
  }
  .list--mono code,
  .list code {
    overflow-wrap: anywhere;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
  }
  .inline {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.875rem;
  }
  .select {
    min-block-size: 2.25rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    font: inherit;
  }
  .inline input {
    inline-size: 1.25rem;
    block-size: 1.25rem;
    accent-color: var(--tx-primary);
  }
  .select:focus-visible,
  .inline input:focus-visible,
  .more summary:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .scroll {
    max-block-size: 18rem;
    overflow: auto;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
  }
  .table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  .table th,
  .table td {
    padding: 0.35rem 0.5rem;
    border-block-end: 1px solid var(--tx-border);
    text-align: start;
    font-variant-numeric: tabular-nums;
  }
  .table thead th {
    position: sticky;
    inset-block-start: 0;
    background: var(--tx-surface, var(--tx-background));
  }
  .more summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
  }
  .more {
    display: grid;
    gap: 0.5rem;
  }
  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (forced-colors: active) {
    .panel,
    .select,
    .scroll {
      border-color: CanvasText;
    }
  }
</style>
