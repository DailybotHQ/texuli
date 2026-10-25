import { buildCatalog } from '@texuli/catalog/build';
import type { CatalogManifest } from '@texuli/catalog/manifest';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import { DISPLAY_MANIFESTS } from '@texuli/catalog/manifests/display';
import { FORMS_MANIFESTS } from '@texuli/catalog/manifests/forms';
import {
  cardLayoutManifest,
  deckLayoutManifest,
  docLayoutManifest,
  gridLayoutManifest,
  LAYOUTS_MANIFESTS,
  pageLayoutManifest,
} from '@texuli/catalog/manifests/layouts';
import { OVERLAYS_MANIFESTS } from '@texuli/catalog/manifests/overlays';
import {
  type GrammarComponentMeta,
  type GrammarRoleCatalog,
  grammarRolesFromList,
} from '@texuli/catalog/render/grammar';
import { type RenderCatalog, renderCatalogFromBuild } from '@texuli/catalog/render/renderer';

/**
 * The agent surface the golden set targets: every agent-emittable catalog
 * component (the content components and the five content layouts).
 */
export const GOLDEN_LAYOUT_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  pageLayoutManifest,
  docLayoutManifest,
  deckLayoutManifest,
  cardLayoutManifest,
  gridLayoutManifest,
]);

export const GOLDEN_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  ...GOLDEN_LAYOUT_MANIFESTS,
  ...CONTENT_MANIFESTS,
]);

/** Layouts a golden interface starts from: each paints the page's `main`. */
export const GOLDEN_FRAME_IDS = ['layout-page', 'layout-doc', 'layout-deck'] as const;

export function goldenManifest(id: string): CatalogManifest | undefined {
  return GOLDEN_MANIFESTS.find((manifest) => manifest.id === id);
}

const GOLDEN_CATALOG_BUILD = await buildCatalog([
  { name: 'content', manifests: CONTENT_MANIFESTS },
  { name: 'display', manifests: DISPLAY_MANIFESTS },
  { name: 'forms', manifests: FORMS_MANIFESTS },
  { name: 'layouts', manifests: LAYOUTS_MANIFESTS },
  { name: 'overlays', manifests: OVERLAYS_MANIFESTS },
]);

export function goldenRenderCatalog(): RenderCatalog {
  return renderCatalogFromBuild(GOLDEN_CATALOG_BUILD.catalog);
}

/**
 * Heading rank each chart renders for its `title` (read from the components:
 * cartesian and matrix charts use `h2`; flow, geo and part-whole charts `h3`).
 * Compact charts render no heading.
 */
export const CHART_TITLE_LEVELS: Readonly<Record<string, 2 | 3>> = Object.freeze({
  'charts-area': 2,
  'charts-bar': 2,
  'charts-cartesian': 2,
  'charts-combo': 2,
  'charts-line': 2,
  'charts-stacked-bar': 2,
  'charts-bubble': 2,
  'charts-heatmap': 2,
  'charts-scatter': 2,
  'charts-funnel': 3,
  'charts-network': 3,
  'charts-sankey': 3,
  'charts-geo-map': 3,
  'charts-geo-point-map': 3,
  'charts-donut': 3,
  'charts-pie': 3,
  'charts-sunburst': 3,
  'charts-treemap': 3,
});

/** The id the heading projection uses for every outline entry. */
export const GOLDEN_HEADING_ID = 'golden-heading';

/** Grammar roles for the projected golden tree (see `projectOutline`). */
export const GOLDEN_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = Object.freeze([
  { id: GOLDEN_HEADING_ID, role: 'heading', headingLevelProp: 'level' },
  { id: 'layout-page', role: 'landmark', landmark: 'main' },
  { id: 'layout-doc', role: 'landmark', landmark: 'main' },
  { id: 'layout-deck', role: 'landmark', landmark: 'main' },
  { id: 'layout-card', role: 'container' },
  { id: 'layout-grid', role: 'container' },
]);

export const goldenGrammarRoles: GrammarRoleCatalog = grammarRolesFromList(GOLDEN_GRAMMAR_ROLES);
