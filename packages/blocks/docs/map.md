# Map block

The map family renders a `map` block: places, and an optional route, on an
**offline, fictional basemap** (Port Meridian, from `@texuli/data/geo`). It
never loads tiles, geocodes or touches the network. The block takes
**untrusted data**: `parseMapBlock` / `checkMapBlock` validate it before
anything renders, and a rejected block becomes an inert, translatable
notice. Added by T-blocks-map.

```json
{
  "type": "map",
  "id": "delivery-route",
  "label": "Morning delivery route across Port Meridian",
  "title": "Morning delivery route",
  "basemap": "port-meridian",
  "points": [
    { "id": "depot", "label": "North Pier depot", "lng": -18.6, "lat": -30.4, "description": "Vans leave at 07:00.", "tone": "info" },
    { "id": "market", "label": "Meridian Center market", "lng": -19.1, "lat": -30.72, "tone": "success" }
  ],
  "route": ["depot", "market"]
}
```

```svelte
<script lang="ts">
import { loadMapFamily } from '@texuli/blocks';
let { block }: { block: unknown } = $props();
</script>

{#await loadMapFamily() then { default: MapBlockView }}
  <MapBlockView {block} locale="en" headingLevel={3} onselect={(id) => console.log(id)} />
{/await}
```

## Entry points

| Import | What | Measured gzip (`pnpm size`, 2026-10-24) |
| --- | --- | --- |
| `@texuli/blocks` | `parseMapBlock`, `checkMapBlock`, `isMapBlock`, `loadMapFamily`, `MAP_BASEMAPS`, `MAP_LIMITS`, `MAP_BLOCK_TYPES` and the types | Root 27.27 KiB today; the map family added 1.33 KiB (the validator and labels) when it landed. The family chunk loads lazily (6.03 KiB JS); the geo engine and the view never reach the root |
| `@texuli/blocks/map` | the above plus `DEFAULT_MAP_BLOCK_LABELS`, `resolveMapBlockLabels`, `formatMapLabel` | 2.99 KiB |
| `@texuli/blocks/map/renderers` | `MapBlockView`, eager | 8.45 KiB + 1.44 KiB CSS |

## Schema (owned validator)

| Field | Rule |
| --- | --- |
| `type` | `"map"` |
| `label` | Required plain text, ≤ 120: the map's accessible name |
| `title` | Optional plain text, ≤ 120, rendered as a heading (`headingLevel`, default 3) |
| `basemap` | Optional, one of `MAP_BASEMAPS` (`port-meridian`). No URLs, so no tile servers |
| `points` | 1–50 points |
| `points[].id` | Block id (`a-z0-9-`, starts with a letter), unique |
| `points[].label` | Plain text, ≤ 80 |
| `points[].lng` | Finite number in -180…180 |
| `points[].lat` | Finite number in -85.06…85.06 (Web Mercator) |
| `points[].description` | Optional plain text, ≤ 200 |
| `points[].tone` | Optional `BlockTone` |
| `route` | Optional, 2–20 existing point ids, in order, with no stop repeating the previous one |
| `id`, `step`, `reveal`, `tone` | As every block (`parseBlockBase`) |

**Rejected:**
- unknown keys, on the block and on points (`html`, `href`…);
- non-plain objects (a polluted prototype);
- `NaN`, `Infinity` and string coordinates;
- polar latitudes;
- repeated or malformed ids;
- unknown tones and basemaps;
- dangling, short, repeated or oversized routes;
- control and bidirectional override characters, and line breaks in plain
  text (core rules).

Every bad point is reported with its path (`points.1.lng`).

## What renders

- **Title, toolbar and map.**
  - The title is a heading at `headingLevel`.
  - The toolbar holds **Zoom in**, **Zoom out** and **Reset view** buttons.
  - The map surface is a focusable `role="application"` with
    `aria-roledescription="map"` (translatable) and the block `label` as its
    name. **Arrow keys** pan, **+**/**=** and **−** zoom, **0**/**Home**
    reset. Geography is not mirrored in RTL.
- **The SVG is decorative** (`aria-hidden`): the basemap, the dashed route
  and toned markers. Clicking a marker selects it (a pointer shortcut).
  Marker labels show up to 12 places. A label flips to the other side of its
  dot near the edge, and basemap labels that would print over a marker label
  are dropped.
- **Places list:** one button per point (`aria-pressed`) with its
  description. A place outside the current view is marked "outside the
  current view".
- **Route:** "4 stops · 247.1 km". The great-circle length uses `locale`
  through `Intl.NumberFormat`. Then an ordered list of the stops.
- **Selection** is announced in a polite live region: "Selected: Old Mill
  bakery. Ring at the side door." `onselect(id)` fires.
- **Attribution:** the basemap's fictional-place notice, always shown.

**Drawing at 1:1.** The SVG uses the canvas's measured width as its
`viewBox` (16:9, with a 240 px minimum height), so map text keeps its size
on a phone instead of scaling down. Before measurement (server render,
tests) it draws at 800 × 450.

**Translatable labels.** `labels` overrides `invalid`, `roleDescription`,
`zoomIn`, `zoomOut`, `reset`, `controls`, `keyboardHint`, `places`,
`route`, `routeSummary` (`{count}`, `{distance}`), `selected` (`{label}`)
and `offMap`.

**Styling**
- Logical properties throughout; the toolbar sits at the inline end, so it
  mirrors in RTL.
- `@layer tx.components`.
- Token colors: `--tx-primary`, `--tx-info`, `--tx-success`, `--tx-warning`,
  `--tx-destructive`, `--tx-muted*`, `--tx-border*`, `--tx-background` and
  `--tx-foreground`. Map text has a background-colored halo.
- Forced colors map to `Canvas`, `CanvasText` and `Highlight`.
- No motion.

## Examples

`blocks-map` (`packages/examples/src/blocks-map/`) shows a four-stop
delivery route, and a hostile block (a tile URL as basemap, an `href` on a
point) that the guard rejects, with the reasons shown. It has visual
baselines in light and dark, on chromium and mobile.

## Verified

- **Unit tests:** `pnpm vitest run packages/blocks/tests/map.test.ts`, 18
  tests. They cover the schema (valid and 27 hostile or malformed cases, and
  issue paths), the view model (framing, a lone point, route path and
  length, keys, actions, 1:1 sizing, label collisions and flips) and the
  component (accessible structure, list and marker selection,
  keyboard/control pan, zoom and reset, translations and heading level,
  inert hostile text, invalid blocks, no route, the lazy load).
- **Browser checks:** a scratch Playwright spec (not committed), chromium
  and Pixel 7, 12 passed:
  - axe found 0 violations in light and dark, with and without
    `forced-colors: active`;
  - keyboard pan, zoom and reset on the focused map, with a visible outline;
  - Tab order through the toolbar;
  - Enter selects a place, and the live region speaks it;
  - marker click selection;
  - the SVG at 1:1 scale;
  - no request beyond the page origin;
  - the hostile block rejected;
  - RTL mirrors the toolbar but not the geography.

## Limits

- **Not in the core switch.** `safeParseBlock` / `safeParseBlocks` from the
  core do not know `map` yet; validate map blocks with `parseMapBlock`.
  Wiring it into the core switch is a one-line `default` case, offered to
  the lead.
- **One basemap:** Port Meridian only. Distances are real great-circle math
  on fictional coordinates.
- **No clustering:** at most 50 points; marker labels hide above 12 places.
- **No drag to pan** and no wheel or pinch zoom: the keyboard and buttons
  cover pan and zoom. `@texuli/data/map`'s `MapView` is the full
  interactive view.
