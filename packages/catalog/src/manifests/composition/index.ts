/**
 * Catalog manifests for the G20 composition layouts (stack, row, split and
 * grid tile) that `@texuli/player` paints for untrusted trees. Every value is
 * a closed enum or a bounded number, so nothing a blueprint sends reaches CSS
 * as free text. Adopted from the player-held manifests (ADR-008). Build-time
 * only; a subpath group the catalog root does not re-export.
 */
import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import type { GrammarComponentMeta } from '../../render/grammar/types.ts';

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
  dontUseWhen: ['App chrome shells (sidebar, top-nav, dialogs)'],
  a11y: [
    'DOM order stays reading order; the layout never reorders children visually',
    'Logical properties only, so right-to-left content mirrors',
  ],
};
const gap = {
  name: 'gap',
  kind: 'enum' as const,
  enumValues: LAYOUT_GAPS,
  description: 'Space between children.',
};
const children = { name: 'children', kind: 'slot' as const };

export const stackLayoutManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  ...shared,
  id: 'layout-stack',
  label: 'Stack layout',
  summary: 'Children in one column, in reading order, with a fixed gap.',
  useWhen: ['Group content vertically with consistent spacing'],
  props: [gap, children],
  examples: [{ id: 'basic', title: 'Stack', props: { gap: 'medium' } }],
  related: ['layout-row', 'layout-split'],
});

export const rowLayoutManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  ...shared,
  id: 'layout-row',
  label: 'Row layout',
  summary: 'Children side by side, wrapping onto new lines when space runs out.',
  useWhen: ['Place a few items next to each other, such as KPIs or actions'],
  props: [
    gap,
    { name: 'align', kind: 'enum', enumValues: LAYOUT_ALIGNS },
    { name: 'wrap', kind: 'boolean', default: true },
    children,
  ],
  examples: [{ id: 'basic', title: 'Row', props: { gap: 'small', align: 'center' } }],
  related: ['layout-stack', 'layout-grid'],
});

export const splitLayoutManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  ...shared,
  id: 'layout-split',
  label: 'Split layout',
  summary: 'Two panes side by side at a fixed ratio, stacked on narrow screens.',
  useWhen: ['Show a primary pane with a supporting pane, such as text beside a chart'],
  props: [{ name: 'ratio', kind: 'enum', enumValues: SPLIT_RATIOS, default: '1:1' }, gap, children],
  examples: [{ id: 'basic', title: 'Split', props: { ratio: '2:1' } }],
  related: ['layout-row', 'layout-grid'],
});

export const tileLayoutManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  ...shared,
  id: 'layout-tile',
  label: 'Grid tile',
  summary: 'A titled tile inside layout-grid that can span several columns or rows.',
  useWhen: ['Make one dashboard tile wider or taller than its neighbors'],
  props: [
    { name: 'title', kind: 'string', trust: 'untrusted' },
    { name: 'span', kind: 'number', default: 1, description: 'Columns, 1 to 4.' },
    { name: 'rowSpan', kind: 'number', default: 1, description: 'Rows, 1 or 2.' },
    children,
  ],
  examples: [{ id: 'wide', title: 'Wide tile', props: { title: 'Trend', span: 2 } }],
  related: ['layout-grid', 'layout-card'],
});

export const COMPOSITION_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  stackLayoutManifest,
  rowLayoutManifest,
  splitLayoutManifest,
  tileLayoutManifest,
]);

/** Containers; a tile title ranks like a card's. */
export const COMPOSITION_GRAMMAR_ROLES: readonly GrammarComponentMeta[] =
  /* @__PURE__ */ Object.freeze([
    { id: 'layout-stack', role: 'container' },
    { id: 'layout-row', role: 'container' },
    { id: 'layout-split', role: 'container' },
    { id: 'layout-tile', role: 'container', titleHeading: 'nested' },
  ]);
