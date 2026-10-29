/**
 * The painters that take part in spec 0.3.0 interaction (on, bind, reorder)
 * receive their node path as `txPath`, so they can reach the player's
 * interaction access. Only the player's own painters get it: a library
 * component never sees an unknown prop.
 */
export const INTERACTIVE_PAINTER_IDS: ReadonlySet<string> = new Set([
  'action-form',
  'control-choice',
  'control-filter',
  'control-slider',
  'control-toggle',
  'data-board',
  'data-calendar',
  'data-dashboard',
  'data-files',
  'data-filter-builder',
  'data-grid',
  'data-map',
  'data-notification-inbox',
  'data-timeline',
  'data-tree-view',
  'flow-action',
  'form-field',
  'sortable-list',
  'workflow-graph',
]);

export function withNodePath(
  id: string,
  path: string,
  props: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  return INTERACTIVE_PAINTER_IDS.has(id) ? { ...props, txPath: path } : props;
}
