# Offline map

**Package:** `@texuli/data`  
**Lazy subpath:** `@texuli/data/map`  
**Engine:** `packages/data/src/engines/map/`  
**View:** `packages/data/src/map/`  
**Tests:** `packages/data/tests/map.test.ts`  
**Example:** `data-map`

## Goal

An offline, fictional vector basemap (Port Meridian) with:

- Markers (shape + glyph + strong tone), clusters, routes and fences (drawn and
  listed; editing a fence is deferred, see [below](#deferred-fence-editing))
- Pointer drag pan, keyboard pan/zoom, optional point pick (`onPick`)
- View state on the surface (`data-center`, `data-zoom`) and `onViewChange`
- A virtualized place list (markers, routes and fences named) kept in sync
- Fluid surface that fills its container; list beside or below
- Host-controlled clustering via `cellPx`

## Usage

```svelte
<script lang="ts">
  import { MapView, type MapMarker, type MapRoute, type MapFence } from '@texuli/data/map';

  const markers: MapMarker[] = [
    {
      id: 'pier',
      lng: -18.6,
      lat: -30.4,
      label: 'North Pier',
      detail: '12 active',
      tone: 'primary',
      shape: 'pin',
      glyph: 'N',
    },
  ];
  const routes: MapRoute[] = [
    {
      id: 'run',
      label: 'Morning run',
      tone: 'info',
      progress: 0.4,
      stops: [
        { lng: -18.6, lat: -30.4 },
        { lng: -19.1, lat: -30.72 },
      ],
    },
  ];
  const fences: MapFence[] = [
    {
      id: 'yard',
      name: 'North yard',
      shape: 'polygon',
      tone: 'warning',
      ring: [
        [-18.7, -30.3],
        [-18.5, -30.3],
        [-18.5, -30.5],
        [-18.7, -30.5],
      ],
    },
  ];
  let selectedId = $state<string | undefined>();
</script>

<div style="block-size: 28rem">
  <MapView
    {markers}
    {routes}
    {fences}
    bind:selectedId
    listPlacement="side"
    cellPx={1}
    label="Harbor coverage"
    onPick={(point) => console.log(point)}
  />
</div>
```

## Props

| Prop | Type | Default | Role |
| --- | --- | --- | --- |
| `basemap` | `Basemap` | Port Meridian | Offline vector basemap |
| `markers` | `MapMarker[]` | `[]` | Places (`id`, `lng`, `lat`, `label`, optional `detail` / `tone` / `shape` / `glyph`) |
| `routes` | `MapRoute[]` | `[]` | Polylines with `label`, `stops`, optional `tone` / `progress` |
| `fences` | `MapFence[]` | `[]` | Polygons or circles with `name`, optional `tone` / `label` |
| `label` | `string` | basemap name | Visible title and map region name |
| `direction` | `'ltr' \| 'rtl'` | `'ltr'` | Writing direction |
| `cellPx` | `number` | `72` | Cluster cell size. Use `1` to keep close markers separate |
| `listPlacement` | `'side' \| 'below'` | `'side'` | Place list beside or under the map |
| `selectedId` | `string \| undefined` (bindable) | — | Selected place id |
| `onSelect` | `(marker) => void` | — | Selection callback |
| `onPick` | `(point: LngLat) => void` | — | Point pick (click without drag, or Enter/Space on the focused surface) |
| `onViewChange` | `({ center, zoom }) => void` | — | Fires after pan/zoom/fit with the current camera |
| `editableFenceId` | `string` | — | **Deferred** host seam (vertex editing not implemented yet) |
| `onFenceChange` | `(fence) => unknown` | — | **Deferred** host seam (vertex editing not implemented yet) |
| `class` | `ClassValue` | — | Root class |

## Tones, shapes and contrast

Markers, routes and fences use **strong** semantic tones only:

`primary` · `info` · `success` · `warning` · `danger` · `neutral`

`default` and `accent` are accepted aliases of `primary` (never soft accent surfaces).
Marker fills and route/fence strokes are gated at **3:1** (UI) against the map plate
in `COMPONENT_CONTRAST_PAIRS` (`map.marker.*`, `map.route.*`, `map.fence.*`) across
the full theme library. Glyph text uses the matching `*Foreground` on the fill (AA text).

Shapes: `circle` (default), `square`, `diamond`, `pin`. Glyph is one or two characters.

## Clustering

`positionMarkers(markers, view, size, cellPx)` buckets points into `cellPx`
squares. The place list always lists every marker once — clustering only
affects the map surface.

## Layout

The map canvas fills its frame (`min-block-size: 16rem`, `aspect-ratio: 5/3`,
and grows when the host gives the root a height). A `ResizeObserver` measures
the surface so projections stay correct. `listPlacement="below"` stacks the
list under the map.

## View state

The map surface (`[role="region"][aria-roledescription="map"]`) exposes:

| Attribute | Format | Updates |
| --- | --- | --- |
| `data-center` | `lat,lng` rounded to **4** decimals | Every pan, zoom, fit, cluster expand |
| `data-zoom` | zoom number as string | Same |

Hosts can also listen with `onViewChange={({ center, zoom }) => …}`.

## Accessibility

- Map surface: `role="region"`, `aria-roledescription="map"`, `tabindex="0"`
- Markers / list rows: accessible name is `label, detail` when detail is set
- Routes and fences appear in the list as `Route: …` / `Fence: …`
- List: virtualized `role="list"` with setsize/posinset, `data-list-item`, `aria-current`
- Clustered points omit `data-marker` until the cluster is expanded

## Deferred: fence editing

`editableFenceId` and `onFenceChange` are accepted so hosts can wire seams
today. Vertex handles and keyboard fence editing are **not implemented yet**.
Use `onPick` for point selection.

## Tokens

Uses `--tx-primary`, `--tx-info`, `--tx-success`, `--tx-warning`,
`--tx-destructive`, matching `*-foreground` roles, `--tx-border`,
`--tx-ring`, with forced-colors fallbacks.
