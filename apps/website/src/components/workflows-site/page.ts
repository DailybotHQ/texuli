/** Static copy for /workflows-page/, shared by the page and its tests. */

export interface WorkflowFeature {
  readonly title: string;
  readonly detail: string;
}

export const WORKFLOW_FEATURES: readonly WorkflowFeature[] = [
  {
    title: 'Typed ports',
    detail: 'A closed node-type registry; edges connect only compatible ports.',
  },
  {
    title: 'Keyboard first',
    detail: 'Arrows move focus between steps, Enter on a port starts a connection.',
  },
  {
    title: 'Auto-layout',
    detail: 'A deterministic layered layout, left to right or top to bottom.',
  },
  {
    title: 'Outline and minimap',
    detail: 'Edit without the canvas, and keep your bearings in big graphs.',
  },
  {
    title: 'Plain JSON',
    detail: 'Graphs are validated data with scalar props; URLs pass the URL policy.',
  },
  {
    title: 'Undo and redo',
    detail: 'Every change is an operation the history can replay.',
  },
];
