/**
 * One lazy chunk for all port definitions (not 64 separate modules).
 * Meta stays on the static graph via `records.ts` → `metadata.ts`.
 */

/** Loads the single definitions module that holds every port record. */
export function loadPortDefinitionsModule(): Promise<typeof import('./definitions.ts')> {
  return import('./definitions.ts');
}
