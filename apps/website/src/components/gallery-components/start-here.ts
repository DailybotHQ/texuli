/**
 * Component-gallery "start here" row (PLAN_006 T-83, gallery punch list row 3).
 * A newcomer cannot read 133 cards at once; this picks the everyday starter
 * set in reading order. Byte routing stays with T-93: the strip is a single
 * server-rendered line, and curated ids that stop existing are skipped, never
 * rendered as dead links.
 */
import type { GalleryComponentCard } from './catalog.ts';

/** The starter set, in the order a newcomer meets them. */
export const START_HERE_IDS = [
  'button',
  'input',
  'card',
  'badge',
  'dialog',
  'select',
  'table',
  'tooltip',
] as const;

/**
 * Resolve the curated ids against the real cards, keeping curated order and
 * skipping ids without a card (a renamed component must not leave a dead
 * link on the page).
 */
export function pickStartHere(
  cards: readonly GalleryComponentCard[],
  ids: readonly string[] = START_HERE_IDS
): GalleryComponentCard[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const picked: GalleryComponentCard[] = [];
  for (const id of ids) {
    const card = byId.get(id);
    if (card) picked.push(card);
  }
  return picked;
}
