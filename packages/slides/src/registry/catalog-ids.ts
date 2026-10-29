/**
 * Which catalog components a slide can paint (ADR-009, component-on-slide
 * contract). Every catalog id is in exactly one of three tables:
 *
 * - `SLIDE_COMPONENTS`: painted on a slide through the player's painters,
 *   with its family (the lazy chunk group), its steppable paths, the state
 *   it needs and the host capability that unlocks its mutations;
 * - `SLIDE_COMPONENT_EXCLUSIONS`: player-painted ids that do not belong on a
 *   slide (deck wrappers, host regions, flows, page containers), each with
 *   its reason;
 * - `SLIDE_EXCLUDED_GROUPS`: whole catalog groups the player has no painter
 *   for (developer-tier display, forms primitives, overlays, app shells).
 *
 * The coverage test reads the catalog manifests and fails when an id is in
 * none of them, so a new catalog component has to choose.
 */

/** The lazy chunk group a slide component loads (one player painter family each). */
export type SlideComponentFamily =
  | 'blocks-text'
  | 'blocks-media'
  | 'blocks-data'
  | 'blocks-code'
  | 'blocks-structure'
  | 'blocks-interactive'
  | 'blocks-map'
  | 'blocks-embed'
  | 'blocks-diagram'
  | 'charts-cartesian'
  | 'charts-compact'
  | 'charts-flow'
  | 'charts-geo'
  | 'charts-matrix'
  | 'charts-part-whole'
  | 'charts-canvas'
  | 'media'
  | 'data'
  | 'chat'
  | 'workflows'
  | 'sortable'
  | 'controls'
  | 'forms';

/** A host capability that unlocks a component's mutations (all off by default, except `reorder`). */
export type SlideCapability = 'reorder' | 'workflow-edit' | 'actions' | 'embeds';

export interface SlideComponentInfo {
  family: SlideComponentFamily;
  /**
   * Where a step marker reveals part of the component, relative to the
   * item (`''` is the whole component, revealed by the item's own `step`).
   */
  stepPaths: readonly string[];
  /** State the adapter declares for the player (`$state` lists, control variables, a form). */
  state?: 'bindings' | 'control' | 'form';
  /** The capability its mutations need; without it the component paints read-only. */
  capability?: SlideCapability;
}

const whole = [''] as const;
const info = (
  family: SlideComponentFamily,
  extra: Omit<SlideComponentInfo, 'family' | 'stepPaths'> = {}
): SlideComponentInfo => Object.freeze({ family, stepPaths: whole, ...extra });

const chart = (family: SlideComponentFamily) => info(family);

/** Every catalog component a slide paints (53 ids). */
export const SLIDE_COMPONENTS: Readonly<Record<string, SlideComponentInfo>> = Object.freeze({
  // The nine @texuli/blocks families, each its own lazy chunk.
  'blocks-text': info('blocks-text'),
  'blocks-media': info('blocks-media'),
  'blocks-data': info('blocks-data'),
  'blocks-code': info('blocks-code'),
  'blocks-structure': info('blocks-structure'),
  'blocks-interactive': info('blocks-interactive', { state: 'bindings' }),
  'blocks-map': info('blocks-map'),
  'blocks-embed': info('blocks-embed', { capability: 'embeds' }),
  'blocks-diagram': info('blocks-diagram'),
  // Charts, one chunk per chart family.
  'charts-area': chart('charts-cartesian'),
  'charts-bar': chart('charts-cartesian'),
  'charts-cartesian': chart('charts-cartesian'),
  'charts-combo': chart('charts-cartesian'),
  'charts-line': chart('charts-cartesian'),
  'charts-stacked-bar': chart('charts-cartesian'),
  'charts-bullet': chart('charts-compact'),
  'charts-gauge': chart('charts-compact'),
  'charts-progress-ring': chart('charts-compact'),
  'charts-sparkline': chart('charts-compact'),
  'charts-funnel': chart('charts-flow'),
  'charts-network': chart('charts-flow'),
  'charts-sankey': chart('charts-flow'),
  'charts-geo-map': chart('charts-geo'),
  'charts-geo-point-map': chart('charts-geo'),
  'charts-bubble': chart('charts-matrix'),
  'charts-heatmap': chart('charts-matrix'),
  'charts-scatter': chart('charts-matrix'),
  'charts-donut': chart('charts-part-whole'),
  'charts-pie': chart('charts-part-whole'),
  'charts-sunburst': chart('charts-part-whole'),
  'charts-treemap': chart('charts-part-whole'),
  'charts-canvas-renderer': chart('charts-canvas'),
  // Media components.
  'media-image': info('media'),
  'media-composition-svg': info('media'),
  'media-composition-canvas': info('media'),
  // Data views (read-only unless the host grants `reorder`).
  'data-board': info('data', { state: 'bindings', capability: 'reorder' }),
  'data-tree-view': info('data', { state: 'bindings' }),
  'data-calendar': info('data'),
  'data-grid': info('data'),
  'data-files': info('data'),
  'data-map': info('data'),
  'data-timeline': info('data'),
  'data-cohort-table': info('data'),
  'data-notification-inbox': info('data'),
  'data-filter-builder': info('data'),
  // Chat (display only) and workflows (view; edit needs `workflow-edit`).
  'chat-thread': info('chat'),
  'chat-message': info('chat'),
  'workflow-graph': info('workflows', { state: 'bindings', capability: 'workflow-edit' }),
  'sortable-list': info('sortable', { state: 'bindings', capability: 'reorder' }),
  // Controls and forms: state the adapter declares; submits need `actions`.
  'control-toggle': info('controls', { state: 'control' }),
  'control-choice': info('controls', { state: 'control' }),
  'control-slider': info('controls', { state: 'control' }),
  'control-filter': info('controls', { state: 'control' }),
  'action-form': info('forms', { state: 'form', capability: 'actions' }),
  'form-field': info('forms', { state: 'form', capability: 'actions' }),
  'form-submit': info('forms', { state: 'form', capability: 'actions' }),
});

/** Player-painted ids that do not belong on a slide, with the reason. */
export const SLIDE_COMPONENT_EXCLUSIONS: Readonly<Record<string, string>> = Object.freeze({
  'layout-deck':
    'A deck wrapper: the slides stage is the deck, so a deck never nests inside a slide.',
  'deck-slide': 'A deck wrapper: slides come from the deck model, not from a catalog node.',
  'host-region':
    'A host-owned region: the host mounts its own content there; authored slides cannot reach it.',
  'flow-view':
    'A blueprint flow view: the deck owns navigation (slides and steps), so a second flow would compete with it.',
  'flow-action':
    'A blueprint flow transition: the deck owns navigation; use slide steps or links instead.',
  'layout-page':
    'A page shell with document landmarks: a slide is not a page; use a slide layout or master.',
  'layout-doc':
    'A document shell with landmarks: a slide is not a document; use a slide layout or master.',
  'layout-card':
    'A container of catalog child nodes: a component item has no children; use a slide layout, a master or `blocks-structure`.',
  'layout-grid':
    'A container of catalog child nodes: use the slide layouts, a master or `blocks-structure` grids.',
  'layout-row':
    'A container of catalog child nodes: use the slide layouts, a master or `blocks-structure` columns.',
  'layout-split':
    'A container of catalog child nodes: use the two-column slide layout or master instead.',
  'layout-stack': 'A container of catalog child nodes: a free slide already stacks its items.',
  'layout-tile':
    'A container of catalog child nodes: use `three-column-cards` or `blocks-structure` cards.',
  document:
    'A whole document (spec 0.7.0): the player paints it only through a host `documentHost` (`@texuli/pages/host`), which the slides stage does not carry; put text on a slide with a layout or the blocks families.',
});

/** Whole catalog groups the player has no painter for, with their ids and the reason. */
export const SLIDE_EXCLUDED_GROUPS: Readonly<
  Record<string, { reason: string; ids: readonly string[] }>
> = Object.freeze({
  display: {
    reason:
      'Developer-tier styled components with no player painter; slides paint the same content through the blocks families (callout, table, stat, code, timeline…).',
    ids: [
      'alert',
      'badge',
      'banner',
      'callout',
      'card',
      'chip',
      'code',
      'empty-state',
      'error-state',
      'inline-text',
      'kbd',
      'kpi',
      'stat',
      'stepper',
      'table',
      'tag',
      'timeline',
    ],
  },
  overlays: {
    reason:
      'Overlays and app navigation need a focus trap, a portal and an Escape lifecycle owned by the host app, never by authored slide content.',
    ids: [
      'alert-dialog',
      'app-nav',
      'breadcrumb',
      'command-palette',
      'context-menu',
      'context-menu-trigger',
      'detail-panel',
      'dialog',
      'drawer',
      'dropdown-menu',
      'dropdown-menu-content',
      'dropdown-menu-item',
      'dropdown-menu-trigger',
      'hover-card',
      'hover-card-content',
      'menubar',
      'menubar-trigger',
      'navigation-menu',
      'pagination',
      'popover',
      'popover-content',
      'responsive-modal',
      'sheet',
      'sidebar',
      'toaster',
      'tooltip',
    ],
  },
  layouts: {
    reason:
      'Application shells and route hosts (sidebars, dashboards, marketing pages, wizards): they own routing and page chrome, which a slide never does.',
    ids: [
      'analytics-grid',
      'content-layout',
      'layout-auth-split',
      'layout-blog',
      'layout-chrome',
      'layout-dashboard-grid',
      'layout-docs',
      'layout-drawer',
      'layout-dual-sidebar',
      'layout-editorial',
      'layout-host',
      'layout-landing',
      'layout-marketing',
      'layout-pricing',
      'layout-settings',
      'layout-sidebar',
      'layout-top-nav',
      'layout-wizard',
      'nav-icon',
      'screen-outlet',
      'split-view',
    ],
  },
  forms: {
    reason:
      'Developer-tier form primitives with callbacks and no player painter; slides use the `control-*` and `form-field` components, which the player paints with declared state.',
    ids: [
      'button',
      'button-group',
      'checkbox',
      'combobox',
      'description',
      'field',
      'field-error',
      'form',
      'icon-button',
      'input',
      'input-group',
      'label',
      'multi-select',
      'radio',
      'radio-group',
      'select',
      'select-content',
      'select-group',
      'select-item',
      'select-label',
      'select-portal',
      'select-separator',
      'select-trigger',
      'select-value',
      'select-viewport',
      'switch',
      'text-counter',
      'textarea',
      'time-field',
    ],
  },
});

/** How a slide treats one catalog id. */
export type SlideComponentSupport =
  | { kind: 'component'; info: SlideComponentInfo }
  | { kind: 'excluded'; reason: string }
  | { kind: 'unknown' };

/** The slide support of a catalog id (own keys only). */
export function slideComponentSupport(id: string): SlideComponentSupport {
  if (Object.hasOwn(SLIDE_COMPONENTS, id)) {
    return { kind: 'component', info: SLIDE_COMPONENTS[id] as SlideComponentInfo };
  }
  if (Object.hasOwn(SLIDE_COMPONENT_EXCLUSIONS, id)) {
    return { kind: 'excluded', reason: SLIDE_COMPONENT_EXCLUSIONS[id] as string };
  }
  for (const group of Object.values(SLIDE_EXCLUDED_GROUPS)) {
    if (group.ids.includes(id)) return { kind: 'excluded', reason: group.reason };
  }
  return { kind: 'unknown' };
}

/** The `blocks-*` id of each block family. */
export const BLOCK_FAMILY_IDS = Object.freeze({
  text: 'blocks-text',
  media: 'blocks-media',
  data: 'blocks-data',
  code: 'blocks-code',
  structure: 'blocks-structure',
  interactive: 'blocks-interactive',
  map: 'blocks-map',
  embed: 'blocks-embed',
  diagram: 'blocks-diagram',
} as const);
