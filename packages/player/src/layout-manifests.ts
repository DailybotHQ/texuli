import type { CatalogManifest } from '@texuli/catalog/manifest';
import { type GrammarComponentMeta, grammarRolesFromList } from '@texuli/catalog/render/grammar';
import { ACTION_GRAMMAR_ROLES } from './action-manifests.ts';
import { CONTROL_GRAMMAR_ROLES } from './control-manifests.ts';
import { FLOW_GRAMMAR_ROLES } from './flow-manifests.ts';
import { REGION_GRAMMAR_ROLES } from './region-manifests.ts';

/**
 * The G20 layout vocabulary (audit G20, player design R16): stack, row,
 * split and tile span, for untrusted trees. Every value is a closed enum or
 * a bounded number, so nothing a blueprint sends reaches CSS as free text.
 * The manifests live in the player until the catalog's layouts group adopts
 * them (the catalog manifests are owned elsewhere).
 */

/** Spacing between children; mapped to fixed lengths by the painter. */
export const LAYOUT_GAPS = ['none', 'small', 'medium', 'large'] as const;
/** Cross-axis alignment of a row's children. */
export const LAYOUT_ALIGNS = ['start', 'center', 'end', 'stretch'] as const;
/** Column ratio of a split's two panes (inline-start : inline-end). */
export const SPLIT_RATIOS = ['1:1', '1:2', '2:1', '1:3', '3:1'] as const;

const shared = {
  package: 'texuli',
  tier: 'content' as const,
  agentEmittable: true,
  dontUseWhen: Object.freeze(['App chrome shells (sidebar, top-nav, dialogs)']),
  a11y: Object.freeze([
    'DOM order stays reading order; the layout never reorders children visually',
    'Logical properties only, so right-to-left content mirrors',
  ]),
};

const gap = {
  name: 'gap',
  kind: 'enum' as const,
  enumValues: LAYOUT_GAPS,
  description: 'Space between children.',
};
const children = { name: 'children', kind: 'slot' as const };

export const stackLayoutManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'layout-stack',
  label: 'Stack layout',
  summary: 'Children in one column, in reading order, with a fixed gap.',
  useWhen: Object.freeze(['Group content vertically with consistent spacing']),
  props: Object.freeze([gap, children]),
  examples: Object.freeze([{ id: 'basic', title: 'Stack', props: { gap: 'medium' } }]),
  related: Object.freeze(['layout-row', 'layout-split']),
}) as CatalogManifest;

export const rowLayoutManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'layout-row',
  label: 'Row layout',
  summary: 'Children side by side, wrapping onto new lines when space runs out.',
  useWhen: Object.freeze(['Place a few items next to each other, such as KPIs or actions']),
  props: Object.freeze([
    gap,
    { name: 'align', kind: 'enum' as const, enumValues: LAYOUT_ALIGNS },
    { name: 'wrap', kind: 'boolean' as const, default: true },
    children,
  ]),
  examples: Object.freeze([
    { id: 'basic', title: 'Row', props: { gap: 'small', align: 'center' } },
  ]),
  related: Object.freeze(['layout-stack', 'layout-grid']),
}) as CatalogManifest;

export const splitLayoutManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'layout-split',
  label: 'Split layout',
  summary: 'Two panes side by side at a fixed ratio, stacked on narrow screens.',
  useWhen: Object.freeze([
    'Show a primary pane with a supporting pane, such as text beside a chart',
  ]),
  props: Object.freeze([
    { name: 'ratio', kind: 'enum' as const, enumValues: SPLIT_RATIOS, default: '1:1' },
    gap,
    children,
  ]),
  examples: Object.freeze([{ id: 'basic', title: 'Split', props: { ratio: '2:1' } }]),
  related: Object.freeze(['layout-row', 'layout-grid']),
}) as CatalogManifest;

export const tileLayoutManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'layout-tile',
  label: 'Grid tile',
  summary: 'A titled tile inside layout-grid that can span several columns or rows.',
  useWhen: Object.freeze(['Make one dashboard tile wider or taller than its neighbors']),
  props: Object.freeze([
    { name: 'title', kind: 'string' as const, trust: 'untrusted' as const },
    { name: 'span', kind: 'number' as const, default: 1, description: 'Columns, 1 to 4.' },
    { name: 'rowSpan', kind: 'number' as const, default: 1, description: 'Rows, 1 or 2.' },
    children,
  ]),
  examples: Object.freeze([{ id: 'wide', title: 'Wide tile', props: { title: 'Trend', span: 2 } }]),
  related: Object.freeze(['layout-grid', 'layout-card']),
}) as CatalogManifest;

export const G20_LAYOUT_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  stackLayoutManifest,
  rowLayoutManifest,
  splitLayoutManifest,
  tileLayoutManifest,
]);

/** Grammar roles for the G20 ids: containers; a tile title ranks like a card's. */
export const G20_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = Object.freeze([
  { id: 'layout-stack', role: 'container' },
  { id: 'layout-row', role: 'container' },
  { id: 'layout-split', role: 'container' },
  { id: 'layout-tile', role: 'container', titleHeading: 'nested' },
]);

/** The default grammar roles plus the G20 layouts, the state-only controls and the host region: what the player validates and paints with. */
export const PLAYER_GRAMMAR_ROLES = grammarRolesFromList([
  ...G20_GRAMMAR_ROLES,
  ...CONTROL_GRAMMAR_ROLES,
  ...REGION_GRAMMAR_ROLES,

  ...FLOW_GRAMMAR_ROLES,
  ...ACTION_GRAMMAR_ROLES,
]);
