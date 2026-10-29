<script lang="ts">
/**
 * /dashboards-page/ persistence lab: a saved dashboard is untrusted input.
 * `parseDashboard` from `@texuli/data/dashboard/engine` reads the text
 * below (from storage, a share link or another person), refuses what is
 * not a dashboard, and clamps, drops or re-places what does not fit,
 * listing every issue; the normalized layout is drawn as a grid and
 * written back with `serializeDashboard`. Engine only: no Svelte view, no
 * storage.
 */
import {
  DEFAULT_DASHBOARD_BREAKPOINTS,
  parseDashboard,
  serializeDashboard,
} from '@texuli/data/dashboard/engine';
import { TAMPERED } from './persistence.ts';

let chosen = $state(TAMPERED[0]?.id ?? 'saved');
let text = $state(TAMPERED[0]?.text ?? '');

const parsed = $derived(parseDashboard(text, { breakpoints: DEFAULT_DASHBOARD_BREAKPOINTS }));
const wide = $derived(parsed.state?.layouts.lg ?? []);
const rows = $derived(Math.max(1, ...wide.map((item) => item.y + item.h)));

function pick(id: string): void {
  const preset = TAMPERED.find((entry) => entry.id === id);
  if (!preset) return;
  chosen = id;
  text = preset.text;
}
</script>

<div class="persist" data-dashboards-persist="">
  <div class="persist__bar" role="group" aria-label="Saved dashboards to read">
    {#each TAMPERED as preset (preset.id)}
      <button
        type="button"
        class="persist__button"
        aria-pressed={chosen === preset.id}
        onclick={() => pick(preset.id)}>{preset.label}</button
      >
    {/each}
  </div>
  <label class="persist__label" for="dashboards-saved-text">Saved dashboard (untrusted text)</label>
  <textarea
    id="dashboards-saved-text"
    class="persist__text"
    rows="5"
    spellcheck="false"
    value={text.length > 2000 ? `${text.slice(0, 2000)}… (${text.length.toLocaleString('en')} characters)` : text}
    oninput={(event) => {
      text = event.currentTarget.value;
      chosen = '';
    }}
    data-dashboards-persist-input=""
  ></textarea>
  <div class="persist__result" role="status" data-dashboards-persist-result="">
    {#if parsed.state === null}
      <p class="persist__refused" data-dashboards-persist-refused="">
        Refused: {parsed.issues.map((issue) => issue.message).join(' ')} Nothing was restored.
      </p>
    {:else if parsed.issues.length === 0}
      <p>Restored as saved: {wide.length} widgets on the wide grid, no issues.</p>
    {:else}
      <p>Restored with {parsed.issues.length} issues fixed on the way:</p>
      <ul class="persist__issues" data-dashboards-persist-issues="">
        {#each parsed.issues.slice(0, 8) as issue, index (index)}
          <li><code>{issue.path || '(root)'}</code>: {issue.message}</li>
        {/each}
        {#if parsed.issues.length > 8}<li>…and {parsed.issues.length - 8} more.</li>{/if}
      </ul>
    {/if}
  </div>
  {#if parsed.state}
    <div class="persist__grid" role="img" aria-label={`The restored wide layout: ${wide.map((item) => `${item.id} at column ${item.x + 1}, row ${item.y + 1}, ${item.w} by ${item.h}`).join('; ') || 'empty'}`} style:grid-template-rows={`repeat(${rows}, 1.5rem)`}>
      {#each wide as item (item.id)}
        <span
          class="persist__cell"
          style:grid-column={`${item.x + 1} / span ${item.w}`}
          style:grid-row={`${item.y + 1} / span ${item.h}`}>{item.id}</span
        >
      {/each}
    </div>
    <pre class="persist__pre" tabindex="0" aria-label="Written back canonically">{serializeDashboard(parsed.state.layouts)}</pre>
  {/if}
</div>

<style>
  .persist {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .persist__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .persist__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .persist__button[aria-pressed='true'] {
    border-color: var(--tx-primary, Highlight);
    background: var(--tx-primary-soft, Canvas);
    color: var(--tx-primary-soft-foreground, CanvasText);
    font-weight: 600;
  }
  .persist__button:focus-visible,
  .persist__text:focus-visible,
  .persist__pre:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .persist__label {
    font-size: 0.875rem;
    font-weight: 600;
  }
  .persist__text {
    inline-size: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, Field);
    color: var(--tx-foreground, FieldText);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
  }
  .persist__result p {
    margin: 0;
    font-size: 0.875rem;
  }
  .persist__refused {
    padding: 0.5rem 0.75rem;
    border-inline-start: 4px solid var(--tx-danger, CanvasText);
    border-radius: 0.4rem;
    background: var(--tx-danger-soft, Canvas);
    color: var(--tx-danger-soft-foreground, CanvasText);
  }
  .persist__issues {
    margin: 0.3rem 0 0;
    padding-inline-start: 1.1rem;
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
  }
  .persist__grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 0.25rem;
    padding: 0.4rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.5rem;
  }
  .persist__cell {
    display: grid;
    place-items: center;
    min-inline-size: 0;
    overflow: hidden;
    border: 1px solid var(--tx-primary, CanvasText);
    border-radius: 0.3rem;
    background: var(--tx-primary-soft, Canvas);
    color: var(--tx-primary-soft-foreground, CanvasText);
    font-size: 0.6875rem;
    font-weight: 600;
  }
  .persist__pre {
    margin: 0;
    max-block-size: 8rem;
    overflow: auto;
    font-size: 0.75rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
