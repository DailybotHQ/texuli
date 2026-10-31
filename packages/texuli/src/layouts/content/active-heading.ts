import { getOwnerWindow } from '@texuli/core/env';

/**
 * The heading a reader is on, tracked on its own (G102): what ContentLayout
 * uses for its table of contents, for hosts that render their own chrome.
 * Framework-free and SSR-safe: it reads no layout until it runs in a
 * browser, and it never scrolls or animates, so reduced motion needs nothing.
 */

/** A heading to track: its id, or an entry that carries one (a `TocItem`). */
export type ActiveHeadingEntry = string | Readonly<{ id: string }>;

export type TrackActiveHeadingOptions = Readonly<{
  /**
   * Where the reading line sits, as a share of the viewport from its top
   * (default `0.3`, clamped to 0–1). The active heading is the last one, in
   * document order, whose top passed it; above them all, the first one.
   */
  readingLine?: number;
  /**
   * The active heading changed. Called with its id and element when the
   * observer reports a heading crossing the line, never twice in a row for
   * the same id.
   */
  onChange?: (id: string, element: HTMLElement | undefined) => void;
  /**
   * The id the host shows as active now, or a getter for it (when the host
   * can change it too). A report equal to it is skipped. Default: the last
   * id this tracker reported.
   */
  activeId?: string | (() => string);
}>;

/** The default reading line: the top 30% of the viewport. */
export const DEFAULT_READING_LINE = 0.3;

/**
 * Track which of `entries` the reader is on. Each entry's element is the one
 * with that id inside `container`, else anywhere in its document; entries
 * with no element are skipped. One IntersectionObserver watches the band
 * above the reading line; positions are read only when it reports. Without
 * a window or an IntersectionObserver (server rendering, old browsers) it
 * does nothing. Returns an idempotent dispose that disconnects the observer;
 * a disposed tracker never reports again.
 */
export function trackActiveHeading(
  container: HTMLElement,
  entries: readonly ActiveHeadingEntry[],
  options: TrackActiveHeadingOptions = {}
): () => void {
  const win = getOwnerWindow(container) as
    | (Window & { IntersectionObserver?: typeof IntersectionObserver })
    | undefined;
  const Observer = win?.IntersectionObserver ?? globalThis.IntersectionObserver;
  if (!win || typeof Observer !== 'function') return () => {};

  const raw = options.readingLine ?? DEFAULT_READING_LINE;
  const line = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : DEFAULT_READING_LINE;
  const headings = resolveHeadings(container, entries);
  let last = typeof options.activeId === 'string' ? options.activeId : '';
  let disposed = false;

  const track = () => {
    if (disposed || headings.length === 0) return;
    const limit = win.innerHeight * line;
    let reading = headings[0] as HTMLElement;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= limit) reading = heading;
      else break;
    }
    const shown = typeof options.activeId === 'function' ? options.activeId() : last;
    if (reading.id === shown) return;
    last = reading.id;
    options.onChange?.(reading.id, reading);
  };

  // The band is the top of the viewport down to the line: crossing its lower edge moves the line.
  const observer = new Observer(track, {
    rootMargin: `0px 0px -${round(100 - line * 100)}% 0px`,
    threshold: [0, 1],
  });
  for (const heading of headings) observer.observe(heading);
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
  };
}

/** The entries' elements, unique, in document order. */
function resolveHeadings(
  container: HTMLElement,
  entries: readonly ActiveHeadingEntry[]
): HTMLElement[] {
  const inside = new Map<string, HTMLElement>();
  for (const element of container.querySelectorAll<HTMLElement>('[id]')) {
    if (!inside.has(element.id)) inside.set(element.id, element);
  }
  const doc = container.ownerDocument;
  const found = new Set<HTMLElement>();
  for (const entry of entries) {
    const id = typeof entry === 'string' ? entry : entry.id;
    const element = inside.get(id) ?? doc.getElementById(id);
    if (element) found.add(element);
  }
  return [...found].sort((a, b) => (a === b ? 0 : a.compareDocumentPosition(b) & 4 ? -1 : 1));
}

const round = (value: number) => Math.round(value * 100) / 100;
