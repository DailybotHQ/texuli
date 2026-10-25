/**
 * Lazy definition entry for the 64-theme port.
 * One chunk: every record lives in {@link PORT_THEME_RECORDS}; this module is
 * the single dynamic import target for `loadLibraryTheme`.
 */
export {
  getPortThemeRecord,
  PORT_THEME_RECORDS,
  requirePortThemeRecord,
} from './records.ts';
export type { LibraryThemeDefinition } from './types.ts';
