import type { PageToken } from '@texuli/primitives/pagination';

function atLeast(value: number, minimum: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : minimum;
}

/** Slots a stable-count pagination always shows once the page count exceeds them. */
export function stablePageSlots(siblings = 1, boundaries = 1): number {
  return 2 * atLeast(boundaries, 0) + 2 * atLeast(siblings, 0) + 3;
}

/**
 * Page tokens with a constant count: once `pageCount` exceeds
 * {@link stablePageSlots}, every page yields exactly that many tokens (pages
 * and ellipses), so the control never changes length under the pointer.
 * Near either end the run of pages widens to fill the slots an ellipsis
 * would leave empty. Pages and ellipses keep the primitive's `PageToken` shape.
 */
export function getStablePageTokens(
  page: number,
  pageCount: number,
  siblings = 1,
  boundaries = 1
): PageToken[] {
  const total = atLeast(pageCount, 1);
  const current = Math.min(atLeast(page, 1), total);
  const sibling = atLeast(siblings, 0);
  const boundary = atLeast(boundaries, 0);
  const slots = stablePageSlots(sibling, boundary);
  const range = (from: number, to: number) =>
    Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);
  if (total <= slots) return range(1, total);

  const head = range(1, boundary);
  const tail = range(total - boundary + 1, total);
  // Pages beside one ellipsis when the current page is near an end.
  const edgeRun = slots - boundary - 1;
  if (current <= boundary + sibling + 2) {
    return [...range(1, edgeRun), 'ellipsis-end', ...tail];
  }
  if (current >= total - boundary - sibling - 1) {
    return [...head, 'ellipsis-start', ...range(total - edgeRun + 1, total)];
  }
  return [
    ...head,
    'ellipsis-start',
    ...range(current - sibling, current + sibling),
    'ellipsis-end',
    ...tail,
  ];
}
