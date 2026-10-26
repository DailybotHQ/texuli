<script lang="ts">
import { onMount, tick } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';
import { createAxis, windowAxis } from '../engines/grid/virtual.ts';
import type { Basemap } from '../engines/map/basemap.ts';
import type { LngLat, MapSize, MapView as MapViewState } from '../engines/map/geo.ts';
import { project, unproject } from '../engines/map/geo.ts';
import { PORT_MERIDIAN } from '../engines/map/port-meridian.ts';
import {
  centerOn,
  circleRadiusPx,
  initialMapView,
  linePath,
  MAP_SIZE,
  type MapFence,
  type MapMarker,
  type MapRoute,
  mapFeatures,
  panMap,
  positionMarkers,
  resolveMapTone,
  routeProgress,
  zoomMap,
} from './model.ts';

const LIST_ROW_PX = 40;
const LIST_MAX_PX = 400;
const PAN_STEP = 56;
const DRAG_THRESHOLD = 4;

/**
 * Fence vertex editing (`editableFenceId` + `onFenceChange`) is deferred:
 * props are accepted for host seams, but handles are not drawn yet. Use
 * `onPick` for point selection. Routes, fences, shapes, glyphs and fluid
 * layout are implemented.
 */
let {
  basemap = PORT_MERIDIAN,
  markers = [],
  routes = [],
  fences = [],
  label,
  direction = 'ltr',
  /** Cluster cell size in projected px. `1` keeps close markers separate; default `72`. */
  cellPx = 72,
  /** Place list beside the map (`side`) or under it (`below`). */
  listPlacement = 'side' as 'side' | 'below',
  selectedId = $bindable<string | undefined>(),
  onSelect,
  onPick,
  /** Fires after pan/zoom with the current camera (center + zoom). */
  onViewChange,
  /** Deferred: accepted for host wiring; vertex editing is not implemented yet. */
  editableFenceId: _editableFenceId = undefined as string | undefined,
  /** Deferred: accepted for host wiring; vertex editing is not implemented yet. */
  onFenceChange: _onFenceChange = undefined as ((fence: MapFence) => unknown) | undefined,
  class: className,
}: {
  basemap?: Basemap;
  markers?: readonly MapMarker[];
  routes?: readonly MapRoute[];
  fences?: readonly MapFence[];
  label?: string;
  direction?: 'ltr' | 'rtl';
  cellPx?: number;
  listPlacement?: 'side' | 'below';
  selectedId?: string;
  onSelect?: (marker: MapMarker) => void;
  onPick?: (point: LngLat) => void;
  onViewChange?: (next: { center: LngLat; zoom: number }) => void;
  editableFenceId?: string;
  onFenceChange?: (fence: MapFence) => unknown;
  class?: ClassValue;
} = $props();

let mapSurface = $state<HTMLElement | null>(null);
let listEl = $state<HTMLElement | null>(null);
let listScroll = $state(0);
let activeIndex = $state(0);
let measured = $state<MapSize>({ width: 0, height: 0 });

const size = $derived<MapSize>(measured.width > 0 && measured.height > 0 ? measured : MAP_SIZE);

let view = $state<MapViewState>((() => initialMapView(basemap, MAP_SIZE))());
let fitted = false;

/** `lat,lng` to 4 decimals for host E2E (`data-center`). */
const dataCenter = $derived(`${view.center.lat.toFixed(4)},${view.center.lng.toFixed(4)}`);
/** Zoom string for host E2E (`data-zoom`). */
const dataZoom = $derived(String(view.zoom));

$effect.pre(() => {
  // Re-fit when the basemap identity changes.
  void basemap;
  if (!fitted) return;
  view = initialMapView(basemap, size);
});

// Notify hosts after every camera change (pan, zoom, fit, cluster expand).
$effect(() => {
  const next = { center: view.center, zoom: view.zoom };
  onViewChange?.(next);
});

onMount(() => {
  if (!mapSurface || typeof ResizeObserver !== 'function') return;
  const observer = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const next = {
      width: Math.max(1, Math.round(entry.contentRect.width)),
      height: Math.max(1, Math.round(entry.contentRect.height)),
    };
    measured = next;
    if (!fitted) {
      fitted = true;
      view = initialMapView(basemap, next);
    }
  });
  observer.observe(mapSurface);
  return () => observer.disconnect();
});

const features = $derived(mapFeatures(basemap, view, size));
const positioned = $derived(positionMarkers(markers, view, size, cellPx));
const selected = $derived(markers.find((marker) => marker.id === selectedId));
const displayLabel = $derived(label ?? basemap.name);

type ListEntry =
  | { kind: 'marker'; marker: MapMarker; index: number }
  | { kind: 'route'; route: MapRoute; index: number }
  | { kind: 'fence'; fence: MapFence; index: number };

const listEntries = $derived.by((): ListEntry[] => {
  const rows: ListEntry[] = [];
  for (const [index, marker] of markers.entries()) rows.push({ kind: 'marker', marker, index });
  for (const [index, route] of routes.entries()) rows.push({ kind: 'route', route, index });
  for (const [index, fence] of fences.entries()) rows.push({ kind: 'fence', fence, index });
  return rows;
});

const listCount = $derived(listEntries.length);
const listAxis = $derived(createAxis({ count: listCount, size: LIST_ROW_PX }));
const listHeight = $derived(
  Math.min(LIST_MAX_PX, Math.max(LIST_ROW_PX, listAxis.total || LIST_ROW_PX))
);
const listWindow = $derived(windowAxis(listAxis, listScroll, listHeight, 4));
const visibleIndices = $derived.by(() => {
  const shown = listWindow.items.map((item) => item.index);
  if (listCount > 0 && !shown.includes(activeIndex)) shown.push(activeIndex);
  return [...new Set(shown)].sort((a, b) => a - b);
});

$effect.pre(() => {
  if (activeIndex >= listCount) activeIndex = Math.max(0, listCount - 1);
});
$effect.pre(() => {
  if (!selectedId) return;
  const index = markers.findIndex((m) => m.id === selectedId);
  if (index !== -1) activeIndex = index;
});

function accessibleName(marker: MapMarker): string {
  return marker.detail ? `${marker.label}, ${marker.detail}` : marker.label;
}

function fenceLabel(fence: MapFence): string {
  return fence.label ?? fence.name;
}

function reset(): void {
  view = initialMapView(basemap, size);
}

function select(marker: MapMarker): void {
  selectedId = marker.id;
  onSelect?.(marker);
}

function selectCluster(cluster: (typeof positioned.clusters)[number]): void {
  view = {
    ...initialMapView({ ...basemap, bbox: [...cluster.bbox] }, size),
    zoom: Math.max(
      view.zoom + 1,
      initialMapView({ ...basemap, bbox: [...cluster.bbox] }, size).zoom
    ),
  };
}

function chooseListMarker(marker: MapMarker, index: number): void {
  activeIndex = index;
  select(marker);
  view = centerOn(marker, Math.max(view.zoom, 8));
}

function pan(dx: number, dy: number): void {
  view = panMap(view, dx, dy, size);
}

function pickAt(x: number, y: number): void {
  if (!onPick) return;
  const point = unproject(x, y, view, size);
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  onPick({ lng: round(point.lng), lat: round(point.lat) });
}

function onMapKeydown(event: KeyboardEvent): void {
  if (event.target !== mapSurface) return;
  const pans: Record<string, [number, number]> = {
    ArrowLeft: [PAN_STEP, 0],
    ArrowRight: [-PAN_STEP, 0],
    ArrowUp: [0, PAN_STEP],
    ArrowDown: [0, -PAN_STEP],
  };
  const step = pans[event.key];
  if (step) {
    event.preventDefault();
    pan(step[0], step[1]);
    return;
  }
  if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    view = zoomMap(view, 1, undefined, size);
    return;
  }
  if (event.key === '-' || event.key === '_') {
    event.preventDefault();
    view = zoomMap(view, -1, undefined, size);
    return;
  }
  if (event.key === '0') {
    event.preventDefault();
    reset();
    return;
  }
  if (onPick && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    pickAt(size.width / 2, size.height / 2);
  }
}

let drag: { pointerId: number; x: number; y: number; moved: boolean } | null = null;
let pressedAt: { x: number; y: number } | null = null;

function localPoint(event: PointerEvent): { x: number; y: number } {
  const rect = mapSurface?.getBoundingClientRect();
  const x = event.clientX - (rect?.left ?? 0);
  const y = event.clientY - (rect?.top ?? 0);
  return Number.isFinite(x) && Number.isFinite(y)
    ? { x: (x / (rect?.width || 1)) * size.width, y: (y / (rect?.height || 1)) * size.height }
    : { x: size.width / 2, y: size.height / 2 };
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !mapSurface) return;
  if ((event.target as HTMLElement | null)?.closest('button')) return;
  drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  pressedAt = localPoint(event);
  mapSurface.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  drag.moved = true;
  // Map CSS size to projection size so drag distance matches the view.
  const rect = mapSurface?.getBoundingClientRect();
  const scaleX = size.width / (rect?.width || size.width);
  const scaleY = size.height / (rect?.height || size.height);
  pan(dx * scaleX, dy * scaleY);
  drag.x = event.clientX;
  drag.y = event.clientY;
}

function onPointerUp(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (mapSurface?.hasPointerCapture(event.pointerId)) {
    mapSurface.releasePointerCapture(event.pointerId);
  }
  if (!drag.moved && onPick && pressedAt) pickAt(pressedAt.x, pressedAt.y);
  drag = null;
  pressedAt = null;
}

async function focusListRow(index: number): Promise<void> {
  if (index < 0 || index >= listCount) return;
  activeIndex = index;
  if (listEl) {
    const top = index * LIST_ROW_PX;
    if (top < listEl.scrollTop) listEl.scrollTop = top;
    else if (top + LIST_ROW_PX > listEl.scrollTop + listHeight) {
      listEl.scrollTop = top + LIST_ROW_PX - listHeight;
    }
    listScroll = listEl.scrollTop;
  }
  await tick();
  listEl?.querySelector<HTMLElement>(`[data-list-index="${index}"]`)?.focus();
}

function onListKeydown(event: KeyboardEvent): void {
  const last = listCount - 1;
  if (last < 0) return;
  const page = Math.max(1, Math.floor(listHeight / LIST_ROW_PX) - 1);
  const next =
    event.key === 'ArrowDown'
      ? Math.min(last, activeIndex + 1)
      : event.key === 'ArrowUp'
        ? Math.max(0, activeIndex - 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : event.key === 'PageDown'
              ? Math.min(last, activeIndex + page)
              : event.key === 'PageUp'
                ? Math.max(0, activeIndex - page)
                : null;
  if (next === null) return;
  event.preventDefault();
  void focusListRow(next);
}

function onListScroll(event: Event): void {
  listScroll = (event.currentTarget as HTMLElement).scrollTop;
}

function listEntryLabel(entry: ListEntry): string {
  if (entry.kind === 'marker') return accessibleName(entry.marker);
  if (entry.kind === 'route') return `Route: ${entry.route.label}`;
  return `Fence: ${fenceLabel(entry.fence)}`;
}

const surfaceHint = $derived(
  `${displayLabel} map with interactive location markers.${onPick ? ' Enter or click picks a point.' : ''}`
);
</script>

<section
  class={cx('map-view', `list-${listPlacement}`, className)}
  dir={direction}
  data-map-view
  data-list-placement={listPlacement}
  data-align-content="start"
>
  <header class="map-header">
    <div>
      <h2>{displayLabel}</h2>
      <p>{basemap.name} · Offline vector map</p>
    </div>
    <div class="controls" role="group" aria-label="Map controls">
      <button type="button" aria-label="Zoom in" onclick={() => (view = zoomMap(view, 1, undefined, size))}
        >+</button
      >
      <button type="button" aria-label="Zoom out" onclick={() => (view = zoomMap(view, -1, undefined, size))}
        >−</button
      >
      <button type="button" aria-label="Reset map view" onclick={reset}>Reset</button>
    </div>
    <div class="pan-controls" role="group" aria-label="Pan map">
      <button type="button" aria-label="Pan map north" onclick={() => pan(0, PAN_STEP)}>↑</button>
      <button type="button" aria-label="Pan map west" onclick={() => pan(PAN_STEP, 0)}>←</button>
      <button type="button" aria-label="Pan map south" onclick={() => pan(0, -PAN_STEP)}>↓</button>
      <button type="button" aria-label="Pan map east" onclick={() => pan(-PAN_STEP, 0)}>→</button>
    </div>
  </header>

  <div class="map-layout">
    <div class="map-frame">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        bind:this={mapSurface}
        class="map-canvas"
        class:picking={Boolean(onPick)}
        role="region"
        aria-roledescription="map"
        aria-label={surfaceHint}
        tabindex="0"
        data-map-surface=""
        data-center={dataCenter}
        data-zoom={dataZoom}
        onkeydown={onMapKeydown}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
      >
        <svg viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true" focusable="false">
          <rect class="water" x="0" y="0" width={size.width} height={size.height} />
          {#each features as feature (feature.id)}
            <path class={`feature ${feature.kind}`} d={feature.d} data-feature={feature.kind} />
            {#if feature.label}
              <text class="feature-label" x={feature.label.x} y={feature.label.y}
                >{feature.label.text}</text
              >
            {/if}
          {/each}
          {#each fences as fence (fence.id)}
            {@const tone = resolveMapTone(fence.tone)}
            {#if fence.shape === 'polygon'}
              <path
                class={`fence tone-${tone}`}
                d={linePath(
                  fence.ring.map(([lng, lat]) => ({ lng, lat })),
                  view,
                  size,
                  true
                )}
                fill={`var(--map-tone-${tone})`}
                fill-opacity="0.18"
                data-fence={fence.id}
              />
            {:else}
              {@const c = project({ lng: fence.center[0], lat: fence.center[1] }, view, size)}
              <circle
                class={`fence tone-${tone}`}
                cx={c.x}
                cy={c.y}
                r={circleRadiusPx(fence, view)}
                fill={`var(--map-tone-${tone})`}
                fill-opacity="0.18"
                data-fence={fence.id}
              />
            {/if}
          {/each}
          {#each routes as route (route.id)}
            {@const tone = resolveMapTone(route.tone)}
            {@const progress = routeProgress(route)}
            <path
              class={`route-base tone-${tone}`}
              d={linePath(route.stops, view, size)}
              fill="none"
              data-route={route.id}
            />
            {#if progress.travelled.length > 1}
              <path
                class={`route-travelled tone-${tone}`}
                d={linePath(progress.travelled, view, size)}
                fill="none"
                data-route-travelled={route.id}
              />
            {/if}
          {/each}
        </svg>
        {#each positioned.clusters as cluster (cluster.id)}
          <button
            class="cluster"
            type="button"
            data-cluster={cluster.id}
            aria-label={`${cluster.count} locations; zoom in`}
            style={`left:${(cluster.x / size.width) * 100}%;top:${(cluster.y / size.height) * 100}%`}
            onclick={() => selectCluster(cluster)}>{cluster.count}</button
          >
        {/each}
        {#each positioned.markers as marker (marker.id)}
          {@const tone = resolveMapTone(marker.tone)}
          {@const shape = marker.shape ?? 'circle'}
          <button
            class={cx('marker', `tone-${tone}`, `shape-${shape}`)}
            class:active={marker.id === selectedId}
            type="button"
            data-marker={marker.id}
            data-shape={shape}
            aria-label={accessibleName(marker)}
            aria-pressed={marker.id === selectedId}
            style={`left:${(marker.x / size.width) * 100}%;top:${(marker.y / size.height) * 100}%`}
            onclick={() => select(marker)}
          >
            <span class="marker-glyph" aria-hidden="true">{marker.glyph ?? ''}</span>
          </button>
        {/each}
        {#if onPick}
          <span class="crosshair" aria-hidden="true"></span>
        {/if}
      </div>
      <p class="attribution">{basemap.attribution}</p>
    </div>

    <aside class="location-panel" aria-label={`${displayLabel} locations`}>
      <h3
        >Locations <span>{markers.length}</span>
        {#if routes.length > 0}<span class="meta">· {routes.length} routes</span>{/if}
        {#if fences.length > 0}<span class="meta">· {fences.length} fences</span>{/if}
      </h3>
      {#if selected}
        <p class="selection" aria-live="polite">Selected: <strong>{selected.label}</strong></p>
      {/if}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        bind:this={listEl}
        class="location-list"
        role="list"
        aria-label="Map places"
        tabindex="0"
        style:block-size={`${listHeight}px`}
        onscroll={onListScroll}
        onkeydown={onListKeydown}
        data-map-place-list=""
      >
        <div class="location-list__spacer" style:block-size={`${listAxis.total}px`}>
          {#each visibleIndices as index (index)}
            {@const entry = listEntries[index]}
            {#if entry}
              <div
                class="location-list__row"
                role="listitem"
                aria-setsize={listCount}
                aria-posinset={index + 1}
                data-list-index={index}
                style:top={`${index * LIST_ROW_PX}px`}
                style:block-size={`${LIST_ROW_PX}px`}
              >
                {#if entry.kind === 'marker'}
                  {@const tone = resolveMapTone(entry.marker.tone)}
                  <button
                    type="button"
                    class:active={entry.marker.id === selectedId}
                    tabindex={index === activeIndex ? 0 : -1}
                    data-list-item={entry.marker.id}
                    aria-label={listEntryLabel(entry)}
                    aria-current={entry.marker.id === selectedId ? 'true' : undefined}
                    aria-pressed={entry.marker.id === selectedId}
                    onclick={() => chooseListMarker(entry.marker, index)}
                    onfocus={() => (activeIndex = index)}
                  >
                    <span class={cx('swatch', `tone-${tone}`)} aria-hidden="true"></span>
                    <span class="location-copy">
                      <strong>{entry.marker.label}</strong>
                      {#if entry.marker.detail}<small>{entry.marker.detail}</small>{/if}
                    </span>
                  </button>
                {:else if entry.kind === 'route'}
                  {@const tone = resolveMapTone(entry.route.tone)}
                  <div
                    class="legend-row"
                    data-list-item={entry.route.id}
                    data-route-list={entry.route.id}
                    tabindex={index === activeIndex ? 0 : -1}
                    onfocus={() => (activeIndex = index)}
                  >
                    <span class={cx('swatch', 'route', `tone-${tone}`)} aria-hidden="true"></span>
                    <span class="location-copy">
                      <strong>{listEntryLabel(entry)}</strong>
                    </span>
                  </div>
                {:else}
                  {@const tone = resolveMapTone(entry.fence.tone)}
                  <div
                    class="legend-row"
                    data-list-item={entry.fence.id}
                    data-fence-list={entry.fence.id}
                    tabindex={index === activeIndex ? 0 : -1}
                    onfocus={() => (activeIndex = index)}
                  >
                    <span class={cx('swatch', 'fence', `tone-${tone}`)} aria-hidden="true"></span>
                    <span class="location-copy">
                      <strong>{listEntryLabel(entry)}</strong>
                    </span>
                  </div>
                {/if}
              </div>
            {/if}
          {:else}
            <div class="empty" role="listitem">No locations</div>
          {/each}
        </div>
      </div>
    </aside>
  </div>
</section>

<style>
  .map-view {
    --map-water: color-mix(in srgb, var(--tx-primary, #2563eb) 16%, var(--tx-background, #fff));
    --map-land: color-mix(in srgb, var(--tx-muted, #8c9a8b) 34%, var(--tx-background, #fff));
    --map-road: color-mix(in srgb, var(--tx-border, #9ba7a8) 70%, transparent);
    /* Strong tone fills — solid roles, never soft/accent surfaces. */
    --map-tone-primary: var(--tx-primary, #2563eb);
    --map-tone-primary-fg: var(--tx-primary-foreground, #fff);
    --map-tone-info: var(--tx-info, #0284c7);
    --map-tone-info-fg: var(--tx-info-foreground, #fff);
    --map-tone-success: var(--tx-success, #16a34a);
    --map-tone-success-fg: var(--tx-success-foreground, #fff);
    --map-tone-warning: var(--tx-warning, #d97706);
    --map-tone-warning-fg: var(--tx-warning-foreground, #111);
    --map-tone-danger: var(--tx-destructive, #dc2626);
    --map-tone-danger-fg: var(--tx-destructive-foreground, #fff);
    --map-tone-neutral: var(--tx-muted-foreground, #4b5563);
    --map-tone-neutral-fg: var(--tx-background, #fff);
    display: grid;
    gap: 1rem;
    /* Keep auto rows packed at the start when the host stretches the root. */
    align-content: start;
    min-block-size: 0;
    min-inline-size: 0;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  .map-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: end;
    gap: 1rem;
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  h2 {
    font-size: 1.1rem;
  }
  .map-header p,
  .selection {
    margin-block-start: 0.25rem;
    color: var(--tx-foreground, CanvasText);
    font-size: 0.8rem;
  }
  .meta {
    font-weight: 400;
    color: var(--tx-muted-foreground, GrayText);
  }
  .controls {
    display: flex;
    gap: 0.375rem;
  }
  button {
    color: inherit;
    font: inherit;
  }
  .controls button,
  .location-list button,
  .legend-row {
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.55rem;
    background: var(--tx-surface, Canvas);
  }
  .controls button {
    min-inline-size: 2.5rem;
    min-block-size: 2.5rem;
    padding-inline: 0.65rem;
    cursor: pointer;
  }
  button:hover,
  button:focus-visible,
  .marker:focus-visible,
  .cluster:focus-visible,
  .legend-row:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .map-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(13rem, 17rem);
    gap: 0.75rem;
    min-block-size: 0;
    min-inline-size: 0;
  }
  .list-below .map-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .map-frame {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    min-block-size: 0;
    overflow: hidden;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.8rem;
    background: var(--map-water);
  }
  .map-canvas {
    position: relative;
    flex: 1 1 auto;
    inline-size: 100%;
    min-block-size: 16rem;
    aspect-ratio: 5 / 3;
    touch-action: none;
    cursor: grab;
  }
  .list-below .map-canvas,
  .map-view:not(.list-side) .map-canvas {
    /* Fluid fill when the host gives the root a height. */
    block-size: 100%;
    max-block-size: none;
  }
  .map-canvas.picking {
    cursor: crosshair;
  }
  .map-canvas:active {
    cursor: grabbing;
  }
  .map-canvas:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .map-canvas svg {
    position: absolute;
    inset: 0;
    display: block;
    inline-size: 100%;
    block-size: 100%;
    pointer-events: none;
  }
  .crosshair {
    position: absolute;
    inset: 50% auto auto 50%;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    transform: translate(-50%, -50%);
    border: 1px solid var(--tx-foreground, CanvasText);
    border-radius: 50%;
    pointer-events: none;
    opacity: 0.55;
  }
  .crosshair::before,
  .crosshair::after {
    content: '';
    position: absolute;
    background: var(--tx-foreground, CanvasText);
  }
  .crosshair::before {
    inset: 50% 0 auto 0;
    block-size: 1px;
    transform: translateY(-50%);
  }
  .crosshair::after {
    inset: 0 auto 0 50%;
    inline-size: 1px;
    transform: translateX(-50%);
  }
  .pan-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .pan-controls button {
    min-inline-size: 2rem;
    min-block-size: 2rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    background: var(--tx-surface, Canvas);
    cursor: pointer;
  }
  .water {
    fill: var(--map-water);
  }
  .feature {
    vector-effect: non-scaling-stroke;
  }
  .feature.land {
    fill: var(--map-land);
    stroke: color-mix(in srgb, var(--tx-foreground, #333) 18%, transparent);
    stroke-width: 1;
  }
  .feature.water {
    fill: color-mix(in srgb, var(--tx-primary, #2563eb) 14%, var(--tx-background, #fff));
    stroke: var(--map-water);
  }
  .feature.park {
    fill: color-mix(in srgb, var(--tx-success, #16a34a) 35%, var(--tx-background, #fff));
    stroke: color-mix(in srgb, var(--tx-success, #16a34a) 55%, transparent);
  }
  .feature.district {
    fill: color-mix(in srgb, var(--tx-background, #fff) 68%, transparent);
    stroke: color-mix(in srgb, var(--tx-foreground, #333) 20%, transparent);
    stroke-width: 0.8;
  }
  .feature.road {
    fill: none;
    stroke: var(--map-road);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .feature.rail {
    fill: none;
    stroke: color-mix(in srgb, var(--tx-muted-foreground, #4b5563) 72%, transparent);
    stroke-width: 1.3;
    stroke-dasharray: 4 3;
  }
  .feature-label {
    fill: var(--tx-foreground, CanvasText);
    font: 8px system-ui, sans-serif;
    font-weight: 600;
    paint-order: stroke;
    stroke: var(--tx-background, white);
    stroke-width: 2.5px;
    stroke-linejoin: round;
    pointer-events: none;
  }
  /* Routes are strokes only — tone rules must never set fill. */
  .route-base,
  .route-travelled {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .route-base {
    stroke-width: 3;
    stroke-dasharray: 4 4;
    opacity: 0.55;
  }
  .route-travelled {
    stroke-width: 4;
  }
  .route-base.tone-primary,
  .route-travelled.tone-primary {
    stroke: var(--map-tone-primary);
    fill: none;
  }
  .route-base.tone-info,
  .route-travelled.tone-info {
    stroke: var(--map-tone-info);
    fill: none;
  }
  .route-base.tone-success,
  .route-travelled.tone-success {
    stroke: var(--map-tone-success);
    fill: none;
  }
  .route-base.tone-warning,
  .route-travelled.tone-warning {
    stroke: var(--map-tone-warning);
    fill: none;
  }
  .route-base.tone-danger,
  .route-travelled.tone-danger {
    stroke: var(--map-tone-danger);
    fill: none;
  }
  .route-base.tone-neutral,
  .route-travelled.tone-neutral {
    stroke: var(--map-tone-neutral);
    fill: none;
  }
  /* Fences keep a translucent fill separate from route strokes. */
  .fence {
    fill-opacity: 0.18;
    stroke-width: 2;
    stroke-dasharray: 6 3;
  }
  .fence.tone-primary {
    stroke: var(--map-tone-primary);
    fill: var(--map-tone-primary);
  }
  .fence.tone-info {
    stroke: var(--map-tone-info);
    fill: var(--map-tone-info);
  }
  .fence.tone-success {
    stroke: var(--map-tone-success);
    fill: var(--map-tone-success);
  }
  .fence.tone-warning {
    stroke: var(--map-tone-warning);
    fill: var(--map-tone-warning);
  }
  .fence.tone-danger {
    stroke: var(--map-tone-danger);
    fill: var(--map-tone-danger);
  }
  .fence.tone-neutral {
    stroke: var(--map-tone-neutral);
    fill: var(--map-tone-neutral);
  }
  .marker,
  .cluster {
    position: absolute;
    z-index: 1;
    display: grid;
    place-items: center;
    transform: translate(-50%, -50%);
    padding: 0;
    border: 2px solid var(--tx-background, white);
    color: var(--map-tone-primary-fg);
    background: var(--map-tone-primary);
    cursor: pointer;
  }
  .marker {
    inline-size: 1.5rem;
    block-size: 1.5rem;
    font-size: 0.65rem;
    font-weight: 700;
    line-height: 1;
  }
  .marker-glyph {
    display: grid;
    place-items: center;
    max-inline-size: 100%;
    overflow: hidden;
  }
  .shape-circle {
    border-radius: 50%;
  }
  .shape-square {
    border-radius: 0.2rem;
  }
  .shape-diamond {
    border-radius: 0.2rem;
    transform: translate(-50%, -50%) rotate(45deg);
  }
  .shape-diamond .marker-glyph {
    transform: rotate(-45deg);
  }
  .shape-pin {
    border-radius: 50% 50% 50% 0;
    transform: translate(-50%, -70%) rotate(-45deg);
  }
  .shape-pin .marker-glyph {
    transform: rotate(45deg);
  }
  .marker.tone-primary {
    background: var(--map-tone-primary);
    color: var(--map-tone-primary-fg);
  }
  .marker.tone-info {
    background: var(--map-tone-info);
    color: var(--map-tone-info-fg);
  }
  .marker.tone-success {
    background: var(--map-tone-success);
    color: var(--map-tone-success-fg);
  }
  .marker.tone-warning {
    background: var(--map-tone-warning);
    color: var(--map-tone-warning-fg);
  }
  .marker.tone-danger {
    background: var(--map-tone-danger);
    color: var(--map-tone-danger-fg);
  }
  .marker.tone-neutral {
    background: var(--map-tone-neutral);
    color: var(--map-tone-neutral-fg);
  }
  .marker.active {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .cluster {
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border-radius: 50%;
    font-size: 0.7rem;
    font-weight: 700;
  }
  .attribution {
    padding-block: 0.4rem;
    padding-inline: 0.65rem;
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
    font-size: 0.75rem;
    font-weight: 500;
  }
  .location-panel {
    min-inline-size: 0;
    overflow: hidden;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.8rem;
    background: var(--tx-surface, Canvas);
  }
  .location-panel h3 {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    justify-content: space-between;
    padding: 0.75rem;
    border-block-end: 1px solid var(--tx-border, ButtonBorder);
    font-size: 0.85rem;
  }
  .selection {
    padding: 0.55rem 0.75rem 0;
  }
  .location-list {
    position: relative;
    overflow: auto;
    margin: 0;
    padding: 0.4rem;
  }
  .location-list__spacer {
    position: relative;
  }
  .location-list__row {
    position: absolute;
    inset-inline: 0.4rem;
    display: flex;
  }
  .location-list button,
  .legend-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    inline-size: 100%;
    min-block-size: calc(100% - 0.2rem);
    margin-block: 0.1rem;
    padding: 0.4rem 0.55rem;
    border-color: transparent;
    text-align: start;
    cursor: pointer;
  }
  .legend-row {
    cursor: default;
  }
  .location-list button:hover,
  .location-list button.active {
    border-color: var(--tx-border, ButtonBorder);
    background: color-mix(in srgb, var(--tx-primary, #2563eb) 9%, var(--tx-surface, white));
  }
  .swatch {
    flex: none;
    inline-size: 0.65rem;
    block-size: 0.65rem;
    border-radius: 50%;
    background: var(--map-tone-primary);
  }
  .swatch.route {
    border-radius: 0.1rem;
    inline-size: 0.9rem;
    block-size: 0.25rem;
  }
  .swatch.fence {
    border-radius: 0.15rem;
    border: 1px dashed currentColor;
    background: color-mix(in srgb, var(--map-tone-warning) 25%, transparent);
  }
  .swatch.tone-primary {
    background: var(--map-tone-primary);
  }
  .swatch.tone-info {
    background: var(--map-tone-info);
  }
  .swatch.tone-success {
    background: var(--map-tone-success);
  }
  .swatch.tone-warning {
    background: var(--map-tone-warning);
  }
  .swatch.tone-danger {
    background: var(--map-tone-danger);
  }
  .swatch.tone-neutral {
    background: var(--map-tone-neutral);
  }
  .location-copy {
    display: grid;
    min-inline-size: 0;
    gap: 0.12rem;
  }
  .location-copy strong {
    overflow: hidden;
    font-size: 0.78rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .location-copy small {
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.68rem;
  }
  .empty {
    padding: 0.8rem;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.8rem;
  }
  @media (max-width: 720px) {
    .map-layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (forced-colors: active) {
    .feature,
    .marker,
    .cluster,
    .fence,
    .route-base,
    .route-travelled {
      forced-color-adjust: auto;
    }
    .feature.road,
    .feature.rail,
    .route-base,
    .route-travelled,
    .fence {
      stroke: CanvasText;
    }
    .feature.land,
    .feature.water,
    .feature.park,
    .feature.district,
    .water {
      fill: Canvas;
      stroke: CanvasText;
    }
    .marker,
    .cluster {
      color: HighlightText;
      background: Highlight;
      border-color: Canvas;
    }
  }
</style>
