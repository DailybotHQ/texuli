<script lang="ts">
/**
 * `comparison-table`: 2–4 options across 3–5 attributes. A real table (row
 * and column headers) for assistive tech; `true`/`false` cells read "Yes"/"No"
 * (layout messages) and show a check or a dash, `null` reads "—".
 */
import { fitContent, fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { layoutMessage } from './messages.ts';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'comparison-table'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
</script>

<LayoutFrame layout="comparison-table" root={steps.at([])}>
  {#if p.title}
    <h2 class="tx-deck-layout__title" data-slot="title" data-clamp="2" {@attach fitText(40)}>
      {p.title}
    </h2>
  {/if}
  <div class="wrap" data-slot="table" {@attach fitContent()}>
    <table class="table">
      {#if p.title}
        <caption class="sr-only">{p.title}</caption>
      {/if}
      <thead>
        <tr>
          <td></td>
          {#each p.columns as column, index (index)}
            <th scope="col" class="tx-deck-layout__lead">{column}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each p.rows as row, r (r)}
          <tr data-slot="row" {...steps.at(['rows', r])}>
            <th scope="row" class="tx-deck-layout__text">{row.label}</th>
            {#each row.values as value, c (c)}
              <td class="tx-deck-layout__text" data-value={value === null ? 'empty' : typeof value}>
                {#if value === true}
                  <span class="mark" aria-hidden="true">✓</span>
                  <span class="sr-only">{layoutMessage('layout.yes')}</span>
                {:else if value === false}
                  <span class="mark" aria-hidden="true">–</span>
                  <span class="sr-only">{layoutMessage('layout.no')}</span>
                {:else if value === null}
                  <span aria-hidden="true">—</span>
                  <span class="sr-only">{layoutMessage('layout.empty')}</span>
                {:else}
                  {value}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</LayoutFrame>

<style>
  .wrap {
    display: grid;
    flex: 1;
    align-content: center;
    min-block-size: 0;
  }

  .table {
    inline-size: 100%;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
  }

  th,
  td {
    padding-block: clamp(12px, 1.4cqi, 20px);
    padding-inline: clamp(12px, 1.6cqi, 24px);
    border-block-end: 1px solid var(--tx-deck-panel-border);
    text-align: start;
    vertical-align: middle;
    overflow-wrap: anywhere;
  }

  thead th {
    font-weight: 700;
    font-family: var(--tx-font-heading, inherit);
    border-block-end: clamp(3px, 0.4cqi, 6px) solid var(--tx-deck-accent);
  }

  tbody th {
    font-weight: 600;
  }

  tbody tr:nth-child(odd) {
    background: var(--tx-deck-panel);
  }

  .mark {
    font-size: 1.3em;
    font-weight: 700;
  }

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
