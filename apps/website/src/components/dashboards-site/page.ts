/**
 * Static copy for /dashboards-page/: the status, the pieces of
 * `@texuli/data/dashboard`, the sections, the keyboard table, the rules
 * and the docs. Plain data, so the page and its tests share one source.
 */

/** The release the dashboard is planned for. It is not in the published 0.7.0. */
export const DASHBOARDS_RELEASE = '0.8.0';

export const DASHBOARDS_STATUS = `Unreleased, coming in ${DASHBOARDS_RELEASE}: not in the published @texuli/data 0.7.0.`;

export const DASHBOARDS_PIECES: readonly { readonly name: string; readonly role: string }[] = [
  { name: 'data/dashboard', role: 'Dashboard and DashboardWidget' },
  { name: 'data/dashboard/engine', role: 'layout math, breakpoints, persistence' },
  { name: 'core/data-source', role: 'host data for widgets' },
  { name: 'drag/gesture', role: 'pointer moves and resizes' },
  { name: 'texuli/motion', role: 'the layout glide' },
];

export interface DashboardsSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
}

export const DASHBOARDS_SECTIONS: readonly DashboardsSection[] = [
  {
    id: 'live',
    title: 'Arrange it yourself',
    summary:
      'Five widgets on a twelve-column grid, their numbers and tickets read from an in-page data source. Drag a widget by its move handle or its corner by the resize handle; or press Space or Enter on a handle, use the arrow keys, and press Space or Enter to drop (Escape puts it back). A click on a handle opens a toolbar, so nothing needs a drag. Every step is announced.',
  },
  {
    id: 'keyboard',
    title: 'Keyboard and announcements',
    summary:
      'Handles are buttons with instructions; the widget moves while focus stays on its handle, and a polite live region announces the pick up, every step, the drop, a cancel and every refusal (a locked widget in the way, an edge, a size limit).',
  },
  {
    id: 'breakpoints',
    title: 'Breakpoints',
    summary:
      'The container’s width picks the grid: the full grid from 1,024 pixels, at most six columns from 640, one stacked column below. A breakpoint without a layout of its own reflows the nearest wider one in reading order. The width control above forces each one, as a print or a preview would.',
  },
  {
    id: 'persistence',
    title: 'Saving a layout, and reading it back',
    summary:
      'Texuli stores nothing itself: the host keeps the bound layouts and writes them with serializeDashboard. What comes back from storage, a link or another person is untrusted, so parseDashboard refuses anything that is not a dashboard, and drops or re-places what does not fit.',
  },
  {
    id: 'agents',
    title: 'Dashboards as agent data',
    summary:
      'An agent sends a data-dashboard with widgets as ordinary catalog nodes (spec 0.8.0). Widget data comes only from a source the host registered, never a URL or code, and the layout binds to a list state so people’s arrangement persists.',
  },
  {
    id: 'safety',
    title: 'What keeps it safe',
    summary: 'A layout is data. These hold by construction in the engine and the catalog.',
  },
];

export interface DashboardKey {
  readonly keys: string;
  readonly does: string;
}

/** The keyboard model of packages/data/docs/data-dashboard.md. */
export const DASHBOARD_KEYS: readonly DashboardKey[] = [
  { keys: 'Tab', does: 'Reach each widget’s move and resize handles in reading order' },
  { keys: 'Space or Enter', does: 'Pick the widget up (or start resizing); again to drop' },
  { keys: 'Arrow keys', does: 'Move one column or row; on the resize handle, change the size' },
  { keys: 'Escape', does: 'Cancel: the widget goes back where it was' },
  { keys: 'Tab while picked up', does: 'Cancel and move on' },
  {
    keys: 'Left and right in right-to-left text',
    does: 'Flip, so “left” follows the reading direction',
  },
];

export const DASHBOARDS_RULES: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'Bounded, deterministic layouts',
    body: 'At most 200 widgets, 24 columns, 48 rows per widget and 512 KiB of saved state. Numbers are clamped before any packing, and normalizing the same widgets gives the same grid on every replica.',
  },
  {
    title: 'Reading order is DOM order',
    body: 'Widgets paint row by row whatever order they were written in, so keyboard and screen-reader order always follow the grid.',
  },
  {
    title: 'Sources, not URLs',
    body: 'A widget’s data is a {"$source": name} binding the host resolves through its registry, with a validated query. A URL or an unknown name is refused before anything paints.',
  },
  {
    title: 'Motion that steps aside',
    body: 'Widgets glide to their new cell only after a change; nothing plays on load, and reduced motion or motion level none commits at once.',
  },
];

export const DASHBOARDS_DOCS: readonly { readonly label: string; readonly path: string }[] = [
  { label: 'Dashboard', path: 'packages/data/docs/data-dashboard.md' },
  { label: 'Dashboard engine', path: 'packages/data/docs/data-dashboard-engine.md' },
  { label: 'Data sources', path: 'packages/core/docs/core-data-source.md' },
  { label: 'Data sources in the player', path: 'packages/player/docs/data-sources.md' },
];
