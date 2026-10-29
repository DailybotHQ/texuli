<script lang="ts">
/**
 * /dashboards-page/ live dashboard: `Dashboard` from
 * `@texuli/data/dashboard`, editable, with widgets whose data comes from
 * the in-page host (`ops.metrics` and `tickets`, read through a
 * `@texuli/core/data-source` loader). Move and resize by pointer or by
 * keyboard (Space or Enter on a handle, arrows, Space or Enter, Escape);
 * a click on a handle opens the arrange toolbar. The controls force a
 * breakpoint (the page column is narrower than the widest grid), switch
 * compaction and turn the layout glide off. "What a screen reader hears"
 * copies the dashboard's own polite live region, so the announcements are
 * visible too; the saved layout is `serializeDashboard` of the bound
 * layouts.
 */
import {
  Dashboard,
  type DashboardCompaction,
  type DashboardLayout,
  DashboardWidget,
  serializeDashboard,
} from '@texuli/data/dashboard';
import { onMount } from 'svelte';
import { createDashboardHost, type Metric, type SourceCall, type Ticket } from './sources.ts';

const BREAKPOINTS = [
  { id: '', label: 'Measured' },
  { id: 'lg', label: 'Wide: 12 columns' },
  { id: 'md', label: 'Medium: 6 columns' },
  { id: 'sm', label: 'Narrow: 1 column' },
] as const;

let root: HTMLElement | undefined = $state();
// The designed layout first; “Measured” lets the container pick (the page column is md).
let breakpoint = $state('lg');
let compaction = $state<DashboardCompaction>('vertical');
let animate = $state(true);
let layouts = $state<Record<string, DashboardLayout>>({});
let saved = $state('');
let heard = $state.raw<readonly string[]>([]);
let active = $state('');
let calls = $state.raw<readonly SourceCall[]>([]);
let loading = $state(true);
let metricRows = $state.raw<readonly Metric[]>([]);
let ticketRows = $state.raw<readonly Ticket[]>([]);
let nextCall = 1;

const host = createDashboardHost((call) => {
  calls = [{ ...call, id: nextCall++ }, ...calls].slice(0, 6);
});

async function load(): Promise<void> {
  loading = true;
  const [metricResult, ticketResult] = await Promise.all([
    host.loader.list('ops.metrics', {}),
    host.loader.list('tickets', {
      filter: {
        type: 'group',
        op: 'and',
        children: [
          { type: 'condition', field: 'status', operator: 'in', value: ['open', 'doing'] },
        ],
      },
      sort: [{ field: 'points', direction: 'desc' }],
    }),
  ]);
  if (metricResult.ok) metricRows = metricResult.value.rows as unknown as Metric[];
  if (ticketResult.ok) ticketRows = ticketResult.value.rows as unknown as Ticket[];
  loading = false;
}

function refresh(): void {
  host.advance();
  void load();
}

const metric = (id: string) => metricRows.find((row) => row.id === id);
const number = (value: number | undefined, unit = '') =>
  value === undefined
    ? '…'
    : `${unit === 'USD' ? '$' : ''}${value.toLocaleString('en', { maximumFractionDigits: 2 })}${unit === '%' ? '%' : ''}`;

onMount(() => {
  void load();
  const region = root?.querySelector('.tx-dashboard [role="status"]');
  const readBreakpoint = () => {
    active = root?.querySelector<HTMLElement>('[data-breakpoint]')?.dataset.breakpoint ?? '';
  };
  readBreakpoint();
  const announcements = new MutationObserver(() => {
    const text = region?.textContent?.trim();
    if (text) heard = [text, ...heard].slice(0, 6);
  });
  if (region)
    announcements.observe(region, { childList: true, characterData: true, subtree: true });
  const attributes = new MutationObserver(readBreakpoint);
  const dashboard = root?.querySelector('[data-breakpoint]');
  if (dashboard)
    attributes.observe(dashboard, { attributes: true, attributeFilter: ['data-breakpoint'] });
  return () => {
    announcements.disconnect();
    attributes.disconnect();
  };
});
</script>

<div class="board" data-dashboards-workbench="" bind:this={root}>
  <div class="board__controls">
    <fieldset class="board__group">
      <legend>Width</legend>
      {#each BREAKPOINTS as option (option.id)}
        <label class="board__choice">
          <input type="radio" name="dashboard-breakpoint" value={option.id} bind:group={breakpoint} />
          {option.label}
        </label>
      {/each}
    </fieldset>
    <fieldset class="board__group">
      <legend>Compaction</legend>
      <label class="board__choice">
        <input type="radio" name="dashboard-compaction" value="vertical" bind:group={compaction} />
        Float up
      </label>
      <label class="board__choice">
        <input type="radio" name="dashboard-compaction" value="none" bind:group={compaction} />
        Keep gaps
      </label>
    </fieldset>
    <fieldset class="board__group">
      <legend>Motion</legend>
      <label class="board__choice">
        <input type="checkbox" bind:checked={animate} data-dashboards-motion="" />
        Glide to the new cell
      </label>
    </fieldset>
    <div class="board__actions">
      <button type="button" class="board__button" onclick={refresh}>Refresh the data</button>
      <button
        type="button"
        class="board__button"
        onclick={() => {
          layouts = {};
          saved = '';
        }}>Reset the layout</button
      >
    </div>
  </div>
  <p class="board__note" data-dashboards-breakpoint="">
    Grid in use: <strong>{active || '…'}</strong>{breakpoint ? ' (forced)' : ' (measured from the container)'}.
  </p>

  <Dashboard
    label="Operations"
    editable
    rowHeight={56}
    {compaction}
    bind:layouts
    {...breakpoint ? { breakpoint } : {}}
    {...animate ? {} : { motion: false }}
    onLayoutChange={() => {
      saved = serializeDashboard(layouts);
    }}
  >
    <DashboardWidget id="signups" title="Signups" x={0} y={0} w={4} h={3} minW={2}>
      <p class="board__value" data-dashboards-metric="signups">{number(metric('signups')?.value)}</p>
      <p class="board__hint">{metric('signups')?.label ?? 'Loading…'}</p>
    </DashboardWidget>
    <DashboardWidget id="revenue" title="Revenue" x={4} y={0} w={5} h={3} minW={3}>
      <p class="board__value">{number(metric('revenue')?.value, 'USD')}</p>
      <p class="board__hint">{metric('revenue')?.label ?? 'Loading…'}</p>
    </DashboardWidget>
    <DashboardWidget id="uptime" title="Uptime (locked)" x={9} y={0} w={3} h={3} locked>
      <p class="board__value">{number(metric('uptime')?.value, '%')}</p>
      <p class="board__hint">Never moves.</p>
    </DashboardWidget>
    <DashboardWidget id="tickets" title="Open tickets" x={0} y={3} w={8} h={6} minH={4}>
      {#if loading && ticketRows.length === 0}
        <p class="board__hint">Loading from the tickets source…</p>
      {:else}
        <ul class="board__list" data-dashboards-tickets="">
          {#each ticketRows as ticket (ticket.id)}
            <li><span>{ticket.title}</span> <span class="board__tag">{ticket.status} · {ticket.points} pts</span></li>
          {/each}
        </ul>
      {/if}
    </DashboardWidget>
    <DashboardWidget id="deploys" title="Deploys" x={8} y={3} w={4} h={6}>
      <p class="board__value">{number(metric('deploys')?.value)}</p>
      <p class="board__hint">{metric('deploys')?.label ?? 'Loading…'}</p>
    </DashboardWidget>
  </Dashboard>

  <div class="board__panels">
    <div class="board__panel">
      <h3 class="board__title">What a screen reader hears</h3>
      <ol class="board__log" aria-label="Recent announcements" data-dashboards-heard="">
        {#each heard as line, index (`${index}-${line}`)}
          <li>{line}</li>
        {:else}
          <li class="board__hint">Pick a widget up with Space or Enter on its move handle.</li>
        {/each}
      </ol>
    </div>
    <div class="board__panel">
      <h3 class="board__title">Saved layout</h3>
      <pre class="board__pre" tabindex="0" aria-label="Saved layout JSON" data-dashboards-saved="">{saved || 'Not changed yet: the widgets use their own places.'}</pre>
    </div>
    <div class="board__panel">
      <h3 class="board__title">Host data source calls</h3>
      <ol class="board__log" aria-label="Recent data source calls" data-dashboards-calls="">
        {#each calls as call (call.id)}
          <li><code>{call.source}</code>: {call.outcome}</li>
        {:else}
          <li class="board__hint">Waiting for the first read.</li>
        {/each}
      </ol>
    </div>
  </div>
</div>

<style>
  .board {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    min-inline-size: 0;
  }
  .board__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: end;
  }
  .board__group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    margin: 0;
    padding: 0.4rem 0.75rem 0.6rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.6rem;
    font-size: 0.875rem;
  }
  .board__group legend {
    padding-inline: 0.25rem;
    font-weight: 600;
  }
  .board__choice {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
    min-block-size: 1.75rem;
  }
  .board__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .board__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .board__button:focus-visible,
  .board__pre:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .board__note,
  .board__hint {
    margin: 0;
    font-size: 0.875rem;
  }
  .board__value {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }
  .board__list {
    display: grid;
    gap: 0.3rem;
    margin: 0;
    padding-inline-start: 1.1rem;
    font-size: 0.875rem;
  }
  .board__tag {
    font-size: 0.75rem;
    font-weight: 600;
  }
  .board__panels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
    gap: 0.75rem;
    align-items: start;
  }
  .board__panel {
    display: grid;
    gap: 0.4rem;
    min-inline-size: 0;
    padding: 0.75rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-surface, Canvas);
  }
  .board__title {
    margin: 0;
    font-size: 0.95rem;
  }
  .board__log {
    display: grid;
    gap: 0.3rem;
    margin: 0;
    padding-inline-start: 1.1rem;
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
  }
  .board__pre {
    margin: 0;
    max-block-size: 12rem;
    overflow: auto;
    font-size: 0.75rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
