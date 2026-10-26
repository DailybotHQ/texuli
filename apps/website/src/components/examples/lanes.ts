/**
 * Examples-index curation (PLAN_006 T-83, gallery punch list row 6): the
 * flat 157-entry catalog gains curated lanes by job and per-family counts.
 * Pure and build-time only — the island below keeps its own filters, and
 * every lane item links to its real `/examples/<id>/` detail route.
 */
import type { ExampleCatalogItem } from './catalog.ts';

export interface ExampleLane {
  id: string;
  title: string;
  description: string;
  match: (item: ExampleCatalogItem) => boolean;
}

/**
 * Lanes by job, not by package: what a newcomer is building, not which layer
 * shipped the demo. One demo may sit on two shelves.
 */
export const EXAMPLE_LANES: readonly ExampleLane[] = [
  {
    id: 'dashboards',
    title: 'Dashboards',
    description: 'Grids, stat tiles and KPI layouts for an at-a-glance screen.',
    match: (item) =>
      ['dashboard', 'grid', 'stat', 'board'].includes(item.kind) || item.tags.includes('dashboard'),
  },
  {
    id: 'forms',
    title: 'Forms',
    description: 'Inputs, selects and the flow between question and answer.',
    match: (item) =>
      [
        'field',
        'input',
        'checkbox',
        'combobox',
        'select',
        'date',
        'file-upload',
        'number-field',
        'rating',
        'slider',
        'stepper',
        'toggle',
        'tags',
      ].includes(item.kind),
  },
  {
    id: 'data-views',
    title: 'Data views',
    description: 'Tables, trees, timelines, calendars and maps over structured data.',
    match: (item) =>
      [
        'table',
        'tree',
        'timeline',
        'calendar',
        'heatmap',
        'histogram',
        'files',
        'activity',
        'map',
        'maps',
        'chart',
        'pie',
        'flow',
      ].includes(item.kind),
  },
  {
    id: 'docs-content',
    title: 'Docs and content',
    description: 'Prose, code, rich text and the structures pages are made of.',
    match: (item) =>
      ['content', 'text', 'code', 'rich-text', 'structure', 'embed', 'thread'].includes(item.kind),
  },
  {
    id: 'decks',
    title: 'Decks',
    description: 'Slide decks and full page layouts, composed from the same parts.',
    match: (item) => item.kind === 'deck' || item.kind === 'layouts',
  },
];

/** How many items a lane shelf shows; the search box above finds the rest. */
export const LANE_CAP = 6;

export interface CuratedLane {
  id: string;
  title: string;
  description: string;
  /** Matching examples in catalog order, capped at `cap`. */
  items: readonly ExampleCatalogItem[];
  /** How many examples matched before the cap. */
  total: number;
}

/** Group a catalog into its non-empty curated lanes (catalog order, capped). */
export function exampleLanes(
  items: readonly ExampleCatalogItem[],
  lanes: readonly ExampleLane[] = EXAMPLE_LANES,
  cap: number = LANE_CAP
): readonly CuratedLane[] {
  const curated: CuratedLane[] = [];
  for (const lane of lanes) {
    const matched = items.filter(lane.match);
    if (matched.length === 0) continue;
    curated.push({
      id: lane.id,
      title: lane.title,
      description: lane.description,
      items: matched.slice(0, cap),
      total: matched.length,
    });
  }
  return curated;
}

export interface PackageCount {
  packageId: string;
  count: number;
}

/** Per-family counts, largest first, ties alphabetical — computed, not claimed. */
export function examplePackageCounts(
  items: readonly ExampleCatalogItem[]
): readonly PackageCount[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.packageId, (counts.get(item.packageId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([packageId, count]) => ({ packageId, count }))
    .sort((a, b) => b.count - a.count || a.packageId.localeCompare(b.packageId, 'en'));
}
