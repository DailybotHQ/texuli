/**
 * Saved dashboards for the /dashboards-page/ persistence lab: one written
 * by `serializeDashboard`, and tampered copies a host might read back
 * from storage or a share link. Each is plain text; `parseDashboard`
 * decides what survives. Fictional ids only.
 */
import { serializeDashboard } from '@texuli/data/dashboard/engine';

export interface SavedDashboard {
  readonly id: string;
  readonly label: string;
  readonly text: string;
}

const SAVED = serializeDashboard({
  lg: [
    { id: 'signups', x: 0, y: 0, w: 4, h: 3 },
    { id: 'revenue', x: 4, y: 0, w: 5, h: 3 },
    { id: 'uptime', x: 9, y: 0, w: 3, h: 3, locked: true },
    { id: 'tickets', x: 0, y: 3, w: 8, h: 6 },
    { id: 'deploys', x: 8, y: 3, w: 4, h: 6 },
  ],
});

const TAMPERED_LAYOUT = JSON.stringify({
  format: 'texuli-dashboard',
  formatVersion: 1,
  layouts: {
    lg: [
      { id: 'signups', x: 0, y: 0, w: 4, h: 2 },
      { id: 'revenue', x: 0, y: 0, w: 4, h: 2 },
      { id: 'uptime', x: 9_999, y: -3, w: 400, h: 2 },
      { id: 'tickets', x: 2.5, y: 'top', w: 8, h: 1e9 },
      { id: 'signups', x: 6, y: 6, w: 2, h: 2 },
      { id: '<img src=x onerror=alert(1)>', x: 0, y: 0, w: 2, h: 2 },
      { id: 'constructor', x: 0, y: 3, w: 2, h: 2, extra: 'ignored' },
      'not a widget',
    ],
    huge: [{ id: 'deploys', x: 0, y: 0, w: 2, h: 2 }],
    '../../etc': [],
  },
});

const NOT_A_DASHBOARD = JSON.stringify({ format: 'texuli-canvas', formatVersion: 1, layouts: {} });

/** A saved state past the 512 KiB cap: refused before it is parsed. */
function oversized(): string {
  const items = Array.from({ length: 14_000 }, (_, index) => ({
    id: `w${index}`,
    x: 0,
    y: index,
    w: 1,
    h: 1,
  }));
  return JSON.stringify({ format: 'texuli-dashboard', formatVersion: 1, layouts: { lg: items } });
}

export const TAMPERED: readonly SavedDashboard[] = [
  { id: 'saved', label: 'As saved', text: SAVED },
  { id: 'tampered', label: 'Tampered', text: TAMPERED_LAYOUT },
  { id: 'other', label: 'Another format', text: NOT_A_DASHBOARD },
  { id: 'broken', label: 'Not JSON', text: '{"format":"texuli-dashboard",' },
  { id: 'oversized', label: 'Too large', text: oversized() },
];
