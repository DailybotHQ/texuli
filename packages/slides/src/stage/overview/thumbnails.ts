/**
 * The overview's lazy chunk: the thumbnail painter (the presenter's live
 * slide preview) and the observer that reports cards scrolled into view, so
 * they paint even far from the selection.
 */
export { default as DeckSlidePreview } from '../presenter/DeckSlidePreview.svelte';

/** Call `onChange` with every card position that enters or leaves the scroll box. */
export function observeCards(
  root: HTMLElement,
  onChange: (changes: readonly [position: number, visible: boolean][]) => void
): () => void {
  if (typeof IntersectionObserver !== 'function') return () => undefined;
  const observer = new IntersectionObserver(
    (records) =>
      onChange(
        records.flatMap((record) => {
          const at = Number((record.target as HTMLElement).dataset.txDeckOverviewPosition);
          return Number.isInteger(at) ? [[at, record.isIntersecting] as [number, boolean]] : [];
        })
      ),
    { root, rootMargin: '25% 0px' }
  );
  for (const card of root.querySelectorAll('[data-tx-deck-overview-position]')) {
    observer.observe(card);
  }
  return () => observer.disconnect();
}
