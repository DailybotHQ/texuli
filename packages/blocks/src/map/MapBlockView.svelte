<script lang="ts">
import { cx } from 'texuli/cx';
import { checkMapBlock } from './check.ts';
import type { MapBlockViewProps } from './family.ts';
import { formatMapLabel, resolveMapBlockLabels } from './labels.ts';
import {
  applyMapAction,
  basemapFeatures,
  basemapFor,
  clearFeatureLabels,
  fitPoints,
  type MapKeyAction,
  mapKeyAction,
  mapSizeFor,
  markerLabelFlips,
  placePoints,
  routeMeters,
  routePath,
  routeStops,
  toneClass,
} from './view-model.ts';

/**
 * Map block: points and an optional route on an offline, fictional basemap.
 * Renders only what `checkMapBlock` accepts; anything else becomes an inert
 * notice. The SVG is decorative: the labeled map region (arrow keys pan,
 * + and − zoom), the controls and the place list carry the meaning.
 */
let { block, labels, locale, headingLevel = 3, oninvalid, onselect }: MapBlockViewProps = $props();

const check = $derived(checkMapBlock(block));
const text = $derived(resolveMapBlockLabels(labels));
const uid = $props.id();

$effect(() => {
  if (!check.ok) oninvalid?.(check.issues);
});

const map = $derived(check.ok ? check.block : null);
const basemap = $derived(map ? basemapFor(map) : null);
/** Canvas width in CSS px; the SVG draws at 1:1 so map text keeps its size. */
let canvasWidth = $state(0);
const size = $derived(mapSizeFor(canvasWidth));
const home = $derived(map && basemap ? fitPoints(map.points, basemap, size) : null);
let moved = $state<typeof home>(null);
const view = $derived(moved ?? home);
let selectedId = $state<string | undefined>();

// New block data starts from its own framing.
$effect.pre(() => {
  void home;
  moved = null;
});

const features = $derived(basemap && view ? basemapFeatures(basemap, view, size) : []);
const placed = $derived(map && view ? placePoints(map.points, view, size) : []);
const stops = $derived(map ? routeStops(map) : []);
const route = $derived(view ? routePath(stops, view, size) : undefined);
const selected = $derived(placed.find((point) => point.id === selectedId));
const showLabels = $derived(placed.length <= 12);
/** Basemap labels that stay clear of the marker labels shown. */
const labeled = $derived(
  clearFeatureLabels(
    features,
    placed.filter((point) => showLabels || point.id === selectedId),
    size
  )
);

const distance = $derived.by(() => {
  const meters = routeMeters(stops);
  const km = meters >= 1000;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: km ? 'kilometer' : 'meter',
    maximumFractionDigits: km ? 1 : 0,
  }).format(km ? meters / 1000 : meters);
});

function act(action: MapKeyAction) {
  if (!view || !home) return;
  moved = action === 'reset' ? null : applyMapAction(view, action, home, size);
}

function onkeydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const action = mapKeyAction(event.key);
  if (!action) return;
  event.preventDefault();
  act(action);
}

function select(id: string) {
  selectedId = id;
  onselect?.(id);
}
</script>

{#if !check.ok || !map || !basemap}
  <p class="tx-map-invalid" role="note" data-tx-block="invalid">{text.invalid}</p>
{:else}
  <div class={cx('tx-map')} data-tx-block="map" role="group" aria-labelledby={`${uid}-name`}>
    {#if map.title}
      <svelte:element this={`h${headingLevel}`} class="tx-map-title">{map.title}</svelte:element>
    {/if}

    <div class="tx-map-controls" role="group" aria-label={text.controls}>
      <button type="button" aria-label={text.zoomIn} onclick={() => act('zoom-in')}><span aria-hidden="true">+</span></button>
      <button type="button" aria-label={text.zoomOut} onclick={() => act('zoom-out')}><span aria-hidden="true">−</span></button>
      <button type="button" onclick={() => act('reset')}>{text.reset}</button>
    </div>
    <div class="tx-map-frame">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -- the map surface is an ARIA application: focusable, arrow keys pan, + and − zoom. -->
      <div
        class="tx-map-canvas"
        role="application"
        tabindex="0"
        aria-roledescription={text.roleDescription}
        aria-label={map.label}
        aria-describedby={`${uid}-hint`}
        {onkeydown}
        bind:clientWidth={canvasWidth}
        data-tx-map-canvas
      >
        <span id={`${uid}-name`} class="tx-map-visually-hidden">{map.label}</span>
        <svg viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true" focusable="false">
          <rect class="water" width={size.width} height={size.height} />
          {#each features as feature (feature.id)}
            <path class={`feature ${feature.kind}`} d={feature.d} />
          {/each}
          {#each labeled as feature (feature.id)}
            {#if feature.label}
              <text class="feature-label" x={feature.label.x} y={feature.label.y}>{feature.label.text}</text>
            {/if}
          {/each}
          {#if route}
            <path class="route" d={route} data-tx-map-route />
          {/if}
          {#each placed as point (point.id)}
            {#if point.visible}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -- pointer shortcut; the place list is the keyboard path. -->
              <g class={cx('marker', toneClass(point.tone), point.id === selectedId && 'selected')} onclick={() => select(point.id)} data-tx-map-marker={point.id}>
                <circle cx={point.x} cy={point.y} r={point.id === selectedId ? 9 : 7} />
                {#if showLabels || point.id === selectedId}
                  {@const flip = markerLabelFlips(point, size)}
                  <text
                    class="marker-label"
                    x={flip ? point.x - 12 : point.x + 12}
                    y={point.y + 4}
                    text-anchor={flip ? 'end' : 'start'}
                  >{point.label}</text>
                {/if}
              </g>
            {/if}
          {/each}
        </svg>
      </div>
    </div>
    <p id={`${uid}-hint`} class="tx-map-hint">{text.keyboardHint}</p>
    <p class="tx-map-attribution">{basemap.attribution}</p>

    <div class="tx-map-panel">
      <div>
        <p class="tx-map-panel-title" id={`${uid}-places`}>{text.places}</p>
        <ul
          class="tx-map-places"
          role="list"
          aria-labelledby={`${uid}-places`}
          data-tx-map-place-list=""
        >
          {#each placed as point, index (point.id)}
            <li
              role="listitem"
              aria-setsize={placed.length}
              aria-posinset={index + 1}
              aria-current={point.id === selectedId ? 'true' : undefined}
            >
              <button
                type="button"
                aria-pressed={point.id === selectedId}
                onclick={() => select(point.id)}
                data-tx-map-place={point.id}
              >
                <span class={cx('swatch', toneClass(point.tone))} aria-hidden="true"></span>
                <span class="place-copy">
                  <span class="place-label">{point.label}</span>
                  {#if point.description}<span class="place-detail">{point.description}</span>{/if}
                  {#if !point.visible}<span class="place-detail">({text.offMap})</span>{/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
      {#if stops.length >= 2}
        <div>
          <p class="tx-map-panel-title" id={`${uid}-route`}>{text.route}</p>
          <p class="tx-map-route-summary" data-tx-map-route-summary>
            {formatMapLabel(text.routeSummary, { count: stops.length, distance })}
          </p>
          <ol class="tx-map-stops" aria-labelledby={`${uid}-route`}>
            {#each stops as stop, index (`${stop.id}-${index}`)}
              <li>{stop.label}</li>
            {/each}
          </ol>
        </div>
      {/if}
    </div>
    <p class="tx-map-selection" aria-live="polite">
      {#if selected}{formatMapLabel(text.selected, { label: selected.label })}{#if selected.description}. {selected.description}{/if}{/if}
    </p>
  </div>
{/if}

<style>
  @layer tx.components {
    .tx-map {
      --map-water: color-mix(in srgb, var(--tx-primary, #2563eb) 16%, var(--tx-background, Canvas));
      --map-land: color-mix(in srgb, var(--tx-muted, #e5e7eb) 70%, var(--tx-background, Canvas));
      display: grid;
      gap: 0.75rem;
      color: var(--tx-foreground, CanvasText);
    }
    .tx-map-title {
      margin: 0;
      font-size: 1.125rem;
      line-height: 1.3;
    }
    .tx-map-frame {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--tx-border, currentColor);
      border-radius: var(--tx-radius, 0.5rem);
      background: var(--map-water);
    }
    .tx-map-canvas {
      display: block;
    }
    .tx-map-canvas:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: calc(-1 * var(--tx-focus-ring-width, 2px));
    }
    svg {
      display: block;
      inline-size: 100%;
      block-size: auto;
    }
    .water {
      fill: var(--map-water);
    }
    .feature {
      vector-effect: non-scaling-stroke;
    }
    .feature.land {
      fill: var(--map-land);
      stroke: color-mix(in srgb, var(--tx-foreground, CanvasText) 20%, transparent);
    }
    .feature.water {
      fill: var(--map-water);
    }
    .feature.park {
      fill: color-mix(in srgb, var(--tx-success, #16a34a) 30%, var(--map-land));
    }
    .feature.district {
      fill: color-mix(in srgb, var(--tx-background, Canvas) 55%, transparent);
      stroke: color-mix(in srgb, var(--tx-foreground, CanvasText) 15%, transparent);
    }
    .feature.road {
      fill: none;
      stroke: color-mix(in srgb, var(--tx-foreground, CanvasText) 35%, transparent);
      stroke-width: 2;
      stroke-linecap: round;
    }
    .feature.rail {
      fill: none;
      stroke: color-mix(in srgb, var(--tx-foreground, CanvasText) 45%, transparent);
      stroke-width: 1.2;
      stroke-dasharray: 4 3;
    }
    .feature-label,
    .marker-label {
      fill: var(--tx-foreground, CanvasText);
      paint-order: stroke;
      stroke: var(--tx-background, Canvas);
      stroke-width: 3px;
      stroke-linejoin: round;
      pointer-events: none;
    }
    .feature-label {
      font-size: 11px;
    }
    .marker-label {
      font-size: 13px;
      font-weight: 600;
    }
    .route {
      fill: none;
      stroke: var(--tx-primary, #2563eb);
      stroke-width: 3;
      stroke-dasharray: 8 5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .marker {
      cursor: pointer;
    }
    .marker circle {
      fill: var(--marker, var(--tx-primary, #2563eb));
      stroke: var(--tx-background, Canvas);
      stroke-width: 2.5;
    }
    .marker.selected circle {
      stroke: var(--tx-foreground, CanvasText);
      stroke-width: 3;
    }
    .tone-accent {
      --marker: var(--tx-primary, #2563eb);
    }
    .tone-neutral {
      --marker: var(--tx-muted-foreground, #4b5563);
    }
    .tone-info {
      --marker: var(--tx-info, #0284c7);
    }
    .tone-success {
      --marker: var(--tx-success, #16a34a);
    }
    .tone-warning {
      --marker: var(--tx-warning, #d97706);
    }
    .tone-danger {
      --marker: var(--tx-destructive, #dc2626);
    }
    .tx-map-controls {
      display: flex;
      gap: 0.25rem;
      justify-content: flex-end;
    }
    button {
      min-block-size: 2rem;
      min-inline-size: 2rem;
      padding-block: 0.25rem;
      padding-inline: 0.5rem;
      border: 1px solid var(--tx-border-strong, currentColor);
      border-radius: var(--tx-radius, 0.375rem);
      background: var(--tx-background, Canvas);
      color: var(--tx-foreground, CanvasText);
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;
    }
    button:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: var(--tx-focus-ring-offset, 2px);
    }
    .tx-map-hint,
    .tx-map-attribution,
    .tx-map-selection {
      margin: 0;
      font-size: 0.8125rem;
    }
    .tx-map-hint,
    .tx-map-attribution {
      color: var(--tx-muted-foreground, CanvasText);
    }
    .tx-map-selection:empty {
      display: none;
    }
    .tx-map-panel {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
    }
    .tx-map-panel-title {
      margin: 0 0 0.375rem;
      font-weight: 600;
    }
    .tx-map-places,
    .tx-map-stops {
      margin: 0;
      padding-inline-start: 0;
    }
    .tx-map-places {
      display: grid;
      gap: 0.25rem;
      list-style: none;
    }
    .tx-map-places button {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
      inline-size: 100%;
      border-color: transparent;
      text-align: start;
    }
    .tx-map-places button[aria-pressed='true'] {
      border-color: var(--tx-border-strong, currentColor);
      background: var(--tx-muted, Canvas);
    }
    .tx-map-stops {
      padding-inline-start: 1.5rem;
    }
    .swatch {
      flex: none;
      inline-size: 0.75rem;
      block-size: 0.75rem;
      margin-block-start: 0.25rem;
      border-radius: 50%;
      background: var(--marker, var(--tx-primary, #2563eb));
    }
    .place-copy {
      display: grid;
    }
    .place-label {
      font-weight: 600;
    }
    .place-detail {
      color: var(--tx-muted-foreground, CanvasText);
      font-size: 0.8125rem;
    }
    .tx-map-route-summary {
      margin: 0 0 0.25rem;
    }
    .tx-map-visually-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .tx-map-invalid {
      padding: 0.5rem 0.75rem;
      border: 1px dashed currentColor;
      border-radius: 0.375rem;
      font-size: 0.875rem;
    }
    @media (forced-colors: active) {
      .feature.land,
      .feature.park,
      .feature.district,
      .water,
      .feature.water {
        fill: Canvas;
        stroke: CanvasText;
      }
      .feature.road,
      .feature.rail,
      .route {
        stroke: CanvasText;
      }
      .marker circle,
      .swatch {
        fill: Highlight;
        background: Highlight;
        stroke: Canvas;
      }
      .feature-label,
      .marker-label {
        fill: CanvasText;
        stroke: Canvas;
      }
    }
  }
</style>
