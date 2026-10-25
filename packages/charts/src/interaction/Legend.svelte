<script lang="ts">
import { type SymbolType, symbolPath } from '../math/shapes/symbol.ts';
import type { LegendItem } from './model.ts';
import { seriesColor, toggleSeries } from './model.ts';
import './interaction.css';

let {
  items,
  hidden = new Set<string>(),
  onchange,
  label = 'Series',
}: {
  items: readonly LegendItem[];
  hidden?: ReadonlySet<string>;
  /** Receives the next hidden set; omit for a static legend. */
  onchange?: (hidden: Set<string>) => void;
  label?: string;
} = $props();

const ids = $derived(items.map((i) => i.id));
const visibleCount = $derived(ids.filter((id) => !hidden.has(id)).length);
</script>

<ul class="tx-chart-legend" aria-label={label} data-chart-legend="">
  {#each items as item, i (item.id)}
    {@const shown = !hidden.has(item.id)}
    {@const locked = shown && visibleCount <= 1}
    {@const swatch = item.color ?? seriesColor(i)}
    {@const symbol = item.symbol ?? 'circle'}
    <li>
      {#if onchange}
        <button
          type="button"
          class="tx-chart-legend__item"
          class:tx-chart-legend__item--hidden={!shown}
          aria-pressed={shown}
          aria-disabled={locked ? 'true' : undefined}
          title={locked
            ? 'At least one series stays visible'
            : shown
              ? `Hide ${item.label}`
              : `Show ${item.label}`}
          onclick={() => {
            if (!locked) onchange(toggleSeries(hidden, item.id, ids));
          }}
        >
          {#if symbol === 'line' || symbol === 'area'}
            <svg class="tx-chart-legend__symbol" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d={symbol === 'line' ? 'M1 6H11' : 'M1 10L4 4L7 7L11 2V10Z'}
                fill={symbol === 'area' && shown ? swatch : 'none'}
                stroke={swatch}
                stroke-width="1.5"
              />
            </svg>
          {:else if symbol === 'bar'}
            <svg class="tx-chart-legend__symbol" viewBox="0 0 12 12" aria-hidden="true">
              <rect x="2" y="2" width="8" height="8" fill={shown ? swatch : 'transparent'} stroke={swatch} />
            </svg>
          {:else}
            <svg class="tx-chart-legend__symbol" viewBox="0 0 12 12" aria-hidden="true">
              <path d={symbolPath(symbol, 6, 6, 48)} fill={shown ? swatch : 'transparent'} stroke={swatch} stroke-width="1" />
            </svg>
          {/if}
          {item.label}
        </button>
      {:else}
        <span class="tx-chart-legend__item tx-chart-legend__item--static">
          {#if symbol === 'line' || symbol === 'area'}
            <svg class="tx-chart-legend__symbol" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d={symbol === 'line' ? 'M1 6H11' : 'M1 10L4 4L7 7L11 2V10Z'}
                fill={symbol === 'area' ? swatch : 'none'}
                fill-opacity={symbol === 'area' ? '0.32' : undefined}
                stroke={swatch}
                stroke-width="1.5"
              />
            </svg>
          {:else if symbol === 'bar'}
            <svg class="tx-chart-legend__symbol" viewBox="0 0 12 12" aria-hidden="true">
              <rect x="2" y="2" width="8" height="8" fill={swatch} stroke={swatch} />
            </svg>
          {:else}
            <svg class="tx-chart-legend__symbol" viewBox="0 0 12 12" aria-hidden="true">
              <path d={symbolPath(symbol, 6, 6, 48)} fill={swatch} stroke={swatch} stroke-width="1" />
            </svg>
          {/if}
          {item.label}
        </span>
      {/if}
    </li>
  {/each}
</ul>
