/**
 * The browser side of hash routing (`#/<slide-id>/<step>`). The engine parses
 * and formats; this module reads `location.hash`, writes with
 * `history.replaceState` (no history entry per step, no scroll jump) and
 * listens for `hashchange`, so deep links and the address bar work.
 *
 * One page has one hash: the first stage that asks claims it, and every
 * later stage on the page stays out of the URL (and out of page-wide
 * shortcuts) until the owner unmounts. Embedded decks therefore never fight
 * over the address bar.
 */
import { type DeckHashLocation, formatDeckHash, parseDeckHash } from '@texuli/deck/engine';

export interface DeckRouteWindow {
  location: { hash: string };
  history: { state: unknown; replaceState(state: unknown, unused: string, url: string): void };
  addEventListener(type: 'hashchange', listener: () => void): void;
  removeEventListener(type: 'hashchange', listener: () => void): void;
}

const owners = new WeakMap<object, string>();

/** Claim the page hash for `instance`; `false` when another stage already owns it. */
export function claimDeckHash(win: object, instance: string): boolean {
  const owner = owners.get(win);
  if (owner !== undefined && owner !== instance) return false;
  owners.set(win, instance);
  return true;
}

export function releaseDeckHash(win: object, instance: string): void {
  if (owners.get(win) === instance) owners.delete(win);
}

/** The deck location in the current hash, or `null` when there is none (or it is hostile). */
export function readDeckHash(win: Pick<DeckRouteWindow, 'location'>): DeckHashLocation | null {
  return parseDeckHash(win.location.hash);
}

/** Write a location with `replaceState` when it differs from the current hash. */
export function writeDeckHash(
  win: Pick<DeckRouteWindow, 'location' | 'history'>,
  location: DeckHashLocation
): boolean {
  const hash = formatDeckHash(location.slideId, location.step);
  if (hash === '#/' || win.location.hash === hash) return false;
  try {
    win.history.replaceState(win.history.state, '', hash);
    return true;
  } catch {
    return false;
  }
}

/** Follow `hashchange`; only valid deck hashes reach `listener`. Returns the cleanup. */
export function watchDeckHash(
  win: DeckRouteWindow,
  listener: (location: DeckHashLocation) => void
): () => void {
  const onChange = () => {
    const location = readDeckHash(win);
    if (location) listener(location);
  };
  win.addEventListener('hashchange', onChange);
  return () => win.removeEventListener('hashchange', onChange);
}
