import type { NavIconName } from './nav-model.ts';

/**
 * Built-in glyphs for every nav icon name (24×24 viewBox, stroked).
 * Original Texuli artwork in one consistent stroke style — not copied paths.
 * The map is a full `Record` so a missing name fails typecheck.
 */
export const NAV_ICON_PATHS: Readonly<Record<NavIconName, string>> = Object.freeze({
  activity: 'M3 12h4l2.5-6 3 12L15 9l2 3h4',
  archive: 'M3 6h18v3H3zM5 9v10h14V9M9 13h6',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  'book-open': 'M12 6c-2-2-5-3-8-2v14c3-1 6 0 8 2 2-2 5-3 8-2V4c-3-1-6 0-8 2Z',
  bot: 'M8 10h8v8H8zM10 8V6h4v2M9 14h.01M15 14h.01M7 18l-2 3M17 18l2 3M12 4v2',
  briefcase: 'M4 8h16v12H4zM9 8V5h6v3M4 13h16',
  building: 'M5 21V5h10v16M15 10h4v11M8 9h2M8 13h2M8 17h2',
  calendar: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
  'chart-column': 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  'chart-line': 'M3 3v18h18M7 15l4-4 3 3 6-7',
  'chart-pie': 'M12 3v9h9A9 9 0 1 1 12 3ZM15 3.5A9 9 0 0 1 20.5 9H15z',
  'check-square': 'M5 4h14v14H5zM8 12l2.5 2.5L16 9',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  code: 'M8 8 4 12l4 4M16 8l4 4-4 4M13 5l-2 14',
  'credit-card': 'M3 6h18v12H3zM3 10h18M7 15h4',
  database:
    'M4 6c0-2 4-3.5 8-3.5s8 1.5 8 3.5-4 3.5-8 3.5S4 8 4 6ZM4 6v6c0 2 4 3.5 8 3.5s8-1.5 8-3.5V6M4 12v6c0 2 4 3.5 8 3.5s8-1.5 8-3.5v-6',
  'file-text': 'M14 3H6v18h12V7zM14 3v4h4M8 13h8M8 17h6',
  folder: 'M3 6h6l2 2h10v11H3z',
  'folder-kanban': 'M3 6h6l2 2h10v11H3zM9 12v5M13 14v3M17 11v6',
  globe:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18',
  'graduation-cap': 'M2 10 12 5l10 5-10 5zM6 12v4c2 2 10 2 12 0v-4M20 11v5',
  heart: 'M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20Z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  home: 'M3 11 12 3l9 8M5 9.5V21h5v-6h4v6h5V9.5',
  inbox: 'M3 13 6 5h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
  kanban: 'M5 4h4v16H5zM10 4h4v10h-4zM15 4h4v13h-4z',
  key: 'M8 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-2h12v2M16 12v3M19 12v2',
  layers: 'M12 3 3 8l9 5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
  'layout-dashboard': 'M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z',
  'life-buoy':
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.9 4.9l3.2 3.2M15.9 15.9l3.2 3.2M4.9 19.1l3.2-3.2M15.9 8.1l3.2-3.2',
  'list-todo': 'M4 5h3v3H4zM4 15h3v3H4zM11 6.5h9M11 16.5h9M4 11.5h3',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  map: 'M3 6 9 4l6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  'map-pin':
    'M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  megaphone: 'M4 11v4h3l6 4V5L7 9H4zM13 9.5c2 .8 4 1 6 .5M13 14.5c2-.5 4-.3 6 .5',
  'message-square': 'M4 4h16v12H8l-4 4z',
  package: 'M3 8 12 3l9 5v8l-9 5-9-5zM12 13V3M3 8l9 5 9-5',
  plug: 'M9 7V3M15 7V3M8 7h8v5a4 4 0 0 1-8 0zM12 16v5',
  plus: 'M12 5v14M5 12h14',
  receipt: 'M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21zM9 8h6M9 12h6M9 16h4',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
  'shopping-cart': 'M3 4h2l2.5 11h11L21 8H6.5M9 20h.01M18 20h.01',
  sparkles:
    'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M6 18l2.5-2.5M12 9.5 13.5 12 12 14.5 10.5 12z',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
  store: 'M3 8 5 4h14l2 4v12H3zM3 8h18M9 12v8M15 12v8',
  tag: 'M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01',
  truck: 'M1 12h11v6H1zM12 14h5l3 3v1h-8zM5 20h.01M17 20h.01M1 12V8h8',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  users:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a7 7 0 0 1 4 7',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v8H3zM3 7V5h14M17 13h2',
  workflow: 'M6 6h4v4H6zM14 6h4v4h-4zM10 14h4v4h-4zM8 10v2h8v-2M12 10v4',
});

/** The neutral glyph for unknown string names: a small filled-looking dot. */
export const NAV_ICON_FALLBACK_PATH = 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z';

/** The stroked path for a nav icon name; unknown names get the neutral dot. */
export function navIconPath(name: string): { path: string; known: boolean } {
  if (Object.hasOwn(NAV_ICON_PATHS, name)) {
    return { path: NAV_ICON_PATHS[name as NavIconName], known: true };
  }
  return { path: NAV_ICON_FALLBACK_PATH, known: false };
}

/** Every built-in nav icon name (full catalog). */
export const NAV_ICON_BUILTINS: readonly NavIconName[] = Object.freeze(
  Object.keys(NAV_ICON_PATHS) as NavIconName[]
);
