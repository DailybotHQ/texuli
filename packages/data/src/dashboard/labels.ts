/** Every visible or accessible string of the `Dashboard` view (announcements live in `DashboardMessages`). */
export interface DashboardLabels {
  /** The move handle's accessible name. */
  moveHandle: (title: string) => string;
  /** The resize handle's accessible name. */
  resizeHandle: (title: string) => string;
  /** The toolbar shown while a widget is picked up (the pointer alternative to dragging). */
  toolbar: (title: string) => string;
  moveLeft: string;
  moveRight: string;
  moveUp: string;
  moveDown: string;
  narrower: string;
  wider: string;
  shorter: string;
  taller: string;
  done: string;
  cancel: string;
  /** Shown when the dashboard has no widgets. */
  empty: string;
}

export type DashboardLabelOverrides = Partial<DashboardLabels>;

export const DEFAULT_DASHBOARD_LABELS: DashboardLabels = Object.freeze({
  moveHandle: (title: string) => `Move ${title}`,
  resizeHandle: (title: string) => `Resize ${title}`,
  toolbar: (title: string) => `Arrange ${title}`,
  moveLeft: 'Move left',
  moveRight: 'Move right',
  moveUp: 'Move up',
  moveDown: 'Move down',
  narrower: 'Narrower',
  wider: 'Wider',
  shorter: 'Shorter',
  taller: 'Taller',
  done: 'Done',
  cancel: 'Cancel',
  empty: 'No widgets yet.',
});
