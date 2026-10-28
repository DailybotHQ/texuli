/**
 * Pure hash route parsing and formatting. Browser `location` is owned by hosts.
 *
 * Format: `#/<slide-id>/<step>` where `slide-id` is a lowercase slug and
 * `step` is a non-negative integer ≤ 32. Hostile input (traversal, uppercase,
 * percent-encoding, query/fragment inside the hash) yields `null`.
 * Print and notes flags live on the search string: `?print=1&notes=1`.
 */

import type { DeckLocation } from './navigation.ts';

/** Maximum slide-id length accepted in a hash (matches model slug bound). */
export const DECK_HASH_ID_MAX = 64;
/** Maximum step index accepted in a hash (matches deck step cap). */
export const DECK_HASH_STEP_MAX = 32;

const SLIDE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface DeckHashLocation {
  slideId: string;
  step: number;
}

export interface DeckRouteFlags {
  print: boolean;
  notes: boolean;
}

export interface ParsedDeckRoute {
  location: DeckHashLocation | null;
  flags: DeckRouteFlags;
}

/**
 * Parse a deck deep link. Accepts `#/id/step`, `#/id`, `/id/step`, or `id/step`.
 * Returns `null` for empty, hostile, or malformed input (never throws).
 */
export function parseDeckHash(raw: string | null | undefined): DeckHashLocation | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 256) return null;
  let value = raw.startsWith('#') ? raw.slice(1) : raw;
  if (value.startsWith('/')) value = value.slice(1);
  if (
    value.includes('?') ||
    value.includes('#') ||
    value.includes('\\') ||
    value.includes('..') ||
    value.includes('//') ||
    value.includes('%')
  ) {
    return null;
  }
  const parts = value.split('/');
  if (parts.length < 1 || parts.length > 2) return null;
  const slideId = parts[0] ?? '';
  if (!SLIDE_ID.test(slideId) || slideId.length > DECK_HASH_ID_MAX) return null;

  if (parts.length === 1) return { slideId, step: 0 };
  const stepRaw = parts[1] ?? '';
  if (!/^\d{1,3}$/.test(stepRaw)) return null;
  const step = Number(stepRaw);
  if (!Number.isInteger(step) || step < 0 || step > DECK_HASH_STEP_MAX) return null;
  return { slideId, step };
}

/**
 * Format a deck deep link as `#/<slide-id>/<step>`. Clamps step to 0…32.
 * Returns `#/` when the id is empty or invalid.
 */
export function formatDeckHash(slideId: string, step = 0): string {
  const id = typeof slideId === 'string' && SLIDE_ID.test(slideId) ? slideId : '';
  const safeStep = Number.isFinite(step)
    ? Math.max(0, Math.min(DECK_HASH_STEP_MAX, Math.floor(step)))
    : 0;
  if (!id) return '#/';
  return `#/${id}/${safeStep}`;
}

/** Parse hash + search into a location and the print/notes flags. */
export function parseDeckRoute(hash: string | null | undefined, search = ''): ParsedDeckRoute {
  const raw = typeof search === 'string' ? search : '';
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  return {
    location: parseDeckHash(hash),
    flags: {
      print: params.get('print') === '1',
      notes: params.get('notes') === '1',
    },
  };
}

/**
 * Format a route string. Flags become a leading query string when set:
 * `?print=1&notes=1#/slide/0`.
 */
export function formatDeckRoute(
  location: Pick<DeckLocation, 'slideId' | 'step'> | DeckHashLocation,
  flags: Partial<DeckRouteFlags> = {}
): string {
  const hash = formatDeckHash(location.slideId, location.step);
  const params = new URLSearchParams();
  if (flags.print) params.set('print', '1');
  if (flags.notes) params.set('notes', '1');
  const query = params.toString();
  return query ? `?${query}${hash}` : hash;
}
