export type PageToken = number | 'ellipsis-start' | 'ellipsis-end';

function integerAtLeast(value: number, minimum: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : minimum;
}

/**
 * Build a bounded, 1-based page model. Short gaps are filled with their page;
 * larger gaps are represented by a labelled-position ellipsis token.
 */
export function getPageTokens(
  page: number,
  pageCount: number,
  siblings = 1,
  boundaries = 1
): PageToken[] {
  const total = integerAtLeast(pageCount, 1);
  const current = Math.min(integerAtLeast(page, 1), total);
  const siblingCount = integerAtLeast(siblings, 0);
  const boundaryCount = Math.min(integerAtLeast(boundaries, 0), total);
  const pages = new Set<number>();

  for (let value = 1; value <= boundaryCount; value += 1) pages.add(value);
  for (
    let value = Math.max(1, current - siblingCount);
    value <= Math.min(total, current + siblingCount);
    value += 1
  ) {
    pages.add(value);
  }
  for (let value = Math.max(1, total - boundaryCount + 1); value <= total; value += 1) {
    pages.add(value);
  }

  const ordered = [...pages].sort((left, right) => left - right);
  const tokens: PageToken[] = [];
  for (const [index, value] of ordered.entries()) {
    if (index > 0) {
      const previous = ordered[index - 1];
      if (previous !== undefined) {
        const gap = value - previous;
        if (gap === 2) tokens.push(previous + 1);
        else if (gap > 2) {
          tokens.push(previous < current ? 'ellipsis-start' : 'ellipsis-end');
        }
      }
    }
    tokens.push(value);
  }
  return tokens;
}

/** Resolve a valid page count from either an explicit count or item total. */
export function getPageCount(pageCount?: number, total?: number, pageSize = 10): number {
  if (pageCount !== undefined && Number.isFinite(pageCount)) {
    return integerAtLeast(pageCount, 1);
  }
  const size = integerAtLeast(pageSize, 1);
  const itemCount = total !== undefined && Number.isFinite(total) ? Math.max(0, total) : 0;
  return Math.max(1, Math.ceil(itemCount / size));
}
