<script lang="ts">
/**
 * /forms-page/ data sources: a form whose choices and checks come from the
 * host's data, through `@texuli/core/data-source`. The in-page host
 * (sources.ts) declares `example.teams` and `example.handles`; the loader
 * validates every query, shares identical reads, caches pages and retries a
 * rate-limited read. The team choices are the rows of `example.teams`, and
 * the `handle-free` validator searches `example.handles`. The request log
 * shows each adapter call with the validated query it received. Nothing
 * leaves the page.
 */
import { SchemaForm } from '@texuli/forms';
import { type CompiledForm, type FormValidator, validateFormSchema } from '@texuli/forms/model';
import { onMount } from 'svelte';
import {
  createFormSourcesHost,
  type FormSourcesHost,
  type SourceLogEntry,
  sourceFormSchema,
} from './sources.ts';

let host: FormSourcesHost | null = null;
let form = $state.raw<CompiledForm | null>(null);
let log = $state.raw<readonly SourceLogEntry[]>([]);
let failed = $state('');
let joined = $state('');
let next = 0;

function report(entry: Omit<SourceLogEntry, 'id'>): void {
  next += 1;
  log = [{ id: next, ...entry }, ...log].slice(0, 8);
}

async function loadTeams(): Promise<void> {
  if (!host) return;
  failed = '';
  const result = await host.loader.list(
    'example.teams',
    { fields: ['id', 'name', 'members'], sort: [{ field: 'name', direction: 'asc' }] },
    { fresh: true }
  );
  if (!result.ok) {
    failed = `The teams could not load (${result.error.code}).`;
    return;
  }
  const options = result.value.rows.map((row) => ({
    value: String(row.id),
    label: `${String(row.name)} (${String(row.members)} people)`,
  }));
  const compiled = validateFormSchema(sourceFormSchema(options), { validators: ['handle-free'] });
  form = compiled.ok ? compiled.form : null;
}

const handleFree: FormValidator = async (value, { signal }) => {
  if (!host || typeof value !== 'string' || value.length < 3) return null;
  const result = await host.loader.list(
    'example.handles',
    { search: value, pageSize: 20 },
    { signal }
  );
  if (!result.ok) return 'The handle could not be checked. Try again.';
  return result.value.rows.some((row) => row.handle === value) ? `${value} is taken.` : null;
};

onMount(() => {
  host = createFormSourcesHost(report);
  void loadTeams();
});
</script>

<div class="sources" data-forms-sources="">
  <div class="sources__form">
    <div class="sources__bar" role="group" aria-label="Host source controls">
      <button
        type="button"
        class="sources__button"
        onclick={() => {
          host?.failNextRead();
          void loadTeams();
        }}>Reload teams with a rate limit</button
      >
    </div>
    {#if failed}
      <p role="alert">{failed}</p>
    {/if}
    {#if form}
      {#key form}
      <SchemaForm
        {form}
        headingLevel={3}
        validators={{ 'handle-free': handleFree }}
        onSubmit={({ values }) => {
          joined = `Joined ${String(values.team)} as ${String(values.handle)}.`;
          return { ok: true };
        }}
      />
      {/key}
    {:else if !failed}
      <p data-forms-sources-loading="">Loading the teams from the host source…</p>
    {/if}
    {#if joined}
      <p class="sources__joined">{joined}</p>
    {/if}
  </div>
  <div class="sources__side">
    <h3 class="sources__title">Request log</h3>
    <p class="sources__hint">
      What each adapter received: a validated query, never a URL or code. Newest first.
    </p>
    <ol class="sources__log" data-forms-sources-log="" aria-label="Adapter calls, newest first">
      {#each log as entry (entry.id)}
        <li>
          <strong>{entry.source}</strong> · {entry.outcome}
          <code>{entry.query}</code>
        </li>
      {:else}
        <li class="sources__empty">No calls yet.</li>
      {/each}
    </ol>
  </div>
</div>

<style>
  .sources {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    gap: 1rem;
    align-items: start;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .sources__form,
  .sources__side {
    display: grid;
    gap: 0.6rem;
    min-inline-size: 0;
  }
  .sources__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .sources__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .sources__button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .sources__title {
    margin: 0;
    font-size: 1rem;
  }
  .sources__hint,
  .sources__joined {
    margin: 0;
    font-size: 0.875rem;
  }
  .sources__hint {
    color: var(--tx-muted-foreground, CanvasText);
  }
  .sources__log {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding-inline-start: 1.25rem;
    font-size: 0.8125rem;
  }
  .sources__log code {
    display: block;
    overflow-wrap: anywhere;
  }
  .sources__empty {
    list-style: none;
    margin-inline-start: -1.25rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
</style>
