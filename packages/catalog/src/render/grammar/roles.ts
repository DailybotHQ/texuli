import type { GrammarComponentMeta, GrammarRoleCatalog } from './types.ts';

/**
 * Stable catalog ids for deck structure (G11). `deck` and `slide` are
 * agent-emittable catalog components; the rest name deck stage chrome and
 * presenter surfaces for hosts that check a rendered stage. They have no
 * catalog manifest.
 */
export const DECK_GRAMMAR_IDS = Object.freeze({
  deck: 'layout-deck',
  slide: 'deck-slide',
  controls: 'deck-controls',
  overview: 'deck-overview',
  notes: 'deck-notes',
  upNext: 'deck-up-next',
} as const);

/**
 * Built-in roles for common Texuli catalog ids.
 * Unknown ids default to `static` in the checker (no hard fail).
 */
export const DEFAULT_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = Object.freeze([
  // Headings / text
  {
    id: 'heading',
    role: 'heading',
    headingLevelProp: 'level',
    nestedRoles: [{ inside: ['button', 'link', 'icon-button', 'tabs-trigger'], role: 'static' }],
  },
  { id: 'blocks-heading', deriveFrom: 'heading' },
  { id: 'text-heading', deriveFrom: 'heading' },
  { id: 'accordion', role: 'container', headingLevelProp: 'headingLevel' },
  // Catalog content: a heading text block keeps its own level
  { id: 'blocks-text', role: 'static', headingBlockProp: 'block' },
  // Content layouts: a page, doc or deck title is the h1 inside `main`; a
  // card title sits one rank below the nearest titled frame around it
  { id: 'layout-page', role: 'landmark', landmark: 'main', titleHeading: 1 },
  { id: 'layout-doc', role: 'landmark', landmark: 'main', titleHeading: 1 },
  { id: 'layout-deck', role: 'landmark', landmark: 'main', titleHeading: 1 },
  { id: 'layout-card', role: 'container', titleHeading: 'nested' },
  { id: 'layout-grid', role: 'container' },
  // Decks (G11): a slide title sits one rank below the deck title, like a
  // card. Stage chrome and presenter surfaces are landmarks while presenting;
  // notes inside a slide are slide data, not a landmark.
  { id: DECK_GRAMMAR_IDS.slide, deriveFrom: 'layout-card' },
  { id: DECK_GRAMMAR_IDS.controls, role: 'container' },
  { id: DECK_GRAMMAR_IDS.overview, role: 'landmark', landmark: 'navigation' },
  {
    id: DECK_GRAMMAR_IDS.notes,
    role: 'landmark',
    landmark: 'complementary',
    nestedRoles: [{ inside: [DECK_GRAMMAR_IDS.slide], role: 'static' }],
  },
  { id: DECK_GRAMMAR_IDS.upNext, role: 'landmark', landmark: 'region' },
  // Charts render their title at a fixed rank (cartesian and matrix h2;
  // flow, geo and part-whole h3); compact charts render no heading
  ...(
    [
      'area',
      'bar',
      'cartesian',
      'combo',
      'line',
      'stacked-bar',
      'bubble',
      'heatmap',
      'scatter',
    ] as const
  ).map(
    (name): GrammarComponentMeta => ({ id: `charts-${name}`, role: 'static', titleHeading: 2 })
  ),
  ...(
    [
      'funnel',
      'network',
      'sankey',
      'geo-map',
      'geo-point-map',
      'donut',
      'pie',
      'sunburst',
      'treemap',
    ] as const
  ).map(
    (name): GrammarComponentMeta => ({ id: `charts-${name}`, role: 'static', titleHeading: 3 })
  ),
  // Interactive
  {
    id: 'button',
    role: 'interactive',
    primaryProp: 'variant',
    primaryValues: ['default', 'primary'],
  },
  { id: 'link', role: 'interactive' },
  { id: 'icon-button', role: 'interactive' },
  { id: 'toggle', role: 'interactive' },
  { id: 'switch', role: 'interactive' },
  { id: 'checkbox', role: 'interactive' },
  { id: 'radio', role: 'interactive' },
  { id: 'input', role: 'interactive' },
  { id: 'textarea', role: 'interactive' },
  { id: 'select', role: 'interactive' },
  { id: 'combobox', role: 'interactive' },
  { id: 'slider', role: 'interactive' },
  { id: 'tabs-trigger', role: 'interactive' },
  // Primary actions (also interactive)
  {
    id: 'button-primary',
    role: 'primary-action',
    primaryProp: 'variant',
    primaryValues: ['default', 'primary'],
  },
  // Containers
  { id: 'card', role: 'container' },
  { id: 'section', role: 'container' },
  { id: 'stack', role: 'container' },
  { id: 'grid', role: 'container' },
  { id: 'form', role: 'container', landmark: 'form' },
  { id: 'dialog', role: 'container' },
  { id: 'sheet', role: 'container' },
  { id: 'popover', role: 'container' },
  { id: 'field', role: 'container' },
  { id: 'fieldset', role: 'container' },
  // Landmarks
  { id: 'main', role: 'landmark', landmark: 'main' },
  { id: 'nav', role: 'landmark', landmark: 'navigation' },
  { id: 'navigation', role: 'landmark', landmark: 'navigation' },
  { id: 'header', role: 'landmark', landmark: 'banner' },
  { id: 'footer', role: 'landmark', landmark: 'contentinfo' },
  { id: 'aside', role: 'landmark', landmark: 'complementary' },
  { id: 'search', role: 'landmark', landmark: 'search' },
  // Order-breaking (rare agent props)
  {
    id: 'absolute-layer',
    role: 'static',
    orderBreakingProps: ['position', 'order', 'zIndex'],
  },
]);

/** Resolve one catalog (a row map plus optional fallback) into frozen metas. */
const DEFAULT_GRAMMAR_CATALOG: GrammarRoleCatalog = buildCatalogWith(
  DEFAULT_GRAMMAR_ROLES,
  undefined
);

function buildCatalogWith(
  list: readonly GrammarComponentMeta[],
  fallback: GrammarRoleCatalog | undefined
): GrammarRoleCatalog {
  const map = new Map<string, GrammarComponentMeta>();
  for (const row of list) {
    map.set(row.id, row);
  }
  const lookup = (id: string): GrammarComponentMeta | undefined => map.get(id) ?? fallback?.get(id);
  for (const [rowId, row] of map) {
    map.set(rowId, Object.freeze(resolveDerived(row, lookup, new Set([rowId]))));
  }
  return {
    get(id: string) {
      return map.get(id) ?? fallback?.get(id);
    },
  };
}

/** Overlay `row`'s explicit fields onto its `deriveFrom` base (transitive). */
function resolveDerived(
  row: GrammarComponentMeta,
  lookup: (id: string) => GrammarComponentMeta | undefined,
  seen: Set<string>
): GrammarComponentMeta {
  const baseId = row.deriveFrom;
  if (!baseId || seen.has(baseId)) {
    return withoutDerived(row);
  }
  const base = lookup(baseId);
  if (!base) {
    return withoutDerived(row);
  }
  seen.add(baseId);
  const resolvedBase = base.deriveFrom ? resolveDerived(base, lookup, seen) : base;
  const explicit: GrammarComponentMeta = { ...row };
  delete explicit.deriveFrom;
  return { ...resolvedBase, ...explicit };
}

/**
 * A row whose derivation is missing or cyclic keeps its own explicit
 * fields; `role` falls back to `static` when the row sets none.
 */
function withoutDerived(row: GrammarComponentMeta): GrammarComponentMeta {
  const own: GrammarComponentMeta = { ...row };
  delete own.deriveFrom;
  if (own.role === undefined) {
    return { ...own, role: 'static' };
  }
  return own;
}

/**
 * Build a role catalog from a list of meta rows. Rows may `deriveFrom`
 * another id and inherit every field they do not set themselves, resolved
 * first against the list, then against the built-in defaults. Derivation
 * cycles keep the row's own explicit fields (`static` when it sets no
 * role).
 */
export function grammarRolesFromList(
  list: readonly GrammarComponentMeta[],
  fallback: GrammarRoleCatalog = DEFAULT_GRAMMAR_CATALOG
): GrammarRoleCatalog {
  return buildCatalogWith(list, fallback);
}

/** Default role catalog used by hosts that have not authored overrides. */
export const defaultGrammarRoles: GrammarRoleCatalog = DEFAULT_GRAMMAR_CATALOG;

/**
 * Effective meta for a node: apply the first `nestedRoles` entry whose
 * `inside` ids include one of the node's enclosing ancestors. An override
 * keeps only the visual-order props — every other behavior follows the
 * new role.
 */
export function resolveNestedRole(
  meta: GrammarComponentMeta,
  ancestorIds: readonly string[]
): GrammarComponentMeta {
  if (!meta.nestedRoles || meta.nestedRoles.length === 0) {
    return meta;
  }
  for (const nested of meta.nestedRoles) {
    if (ancestorIds.some((ancestor) => nested.inside.includes(ancestor))) {
      return {
        id: meta.id,
        role: nested.role,
        orderBreakingProps: meta.orderBreakingProps,
      };
    }
  }
  return meta;
}

export function resolveMeta(roles: GrammarRoleCatalog, id: string): GrammarComponentMeta {
  const meta = roles.get(id) ?? { id, role: 'static' };
  // A declaration may leave role to deriveFrom; unresolved roles stay static.
  return meta.role === undefined ? { ...meta, role: 'static' } : meta;
}

export function isInteractiveRole(role: GrammarComponentMeta['role']): boolean {
  return role === 'interactive' || role === 'primary-action';
}

export function isContainerRole(role: GrammarComponentMeta['role']): boolean {
  return role === 'container' || role === 'landmark';
}
