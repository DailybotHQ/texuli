/**
 * Compact AA-gate summaries for the theme gallery. Pure helpers so unit tests
 * never need the DOM. WCAG 2.x ratios only (APCA out of scope).
 */
import type { AaGateModeReport, AaGatePairResult, AaGateThemeReport } from '@texuli/tokens/aa-gate';

/** Cards per page in the gallery; the build renders the first page. */
export const GALLERY_PAGE_SIZE = 24;

export type GalleryPreviewMode = 'light' | 'dark' | 'high-contrast';

export interface GalleryModeScore {
  mode: GalleryPreviewMode;
  pass: boolean;
  issueCount: number;
  checkedCount: number;
  skippedCount: number;
  /**
   * Lowest checked text pair ratio at display precision (one decimal, as the
   * card prints it); null when every text pair was skipped.
   */
  worstTextRatio: number | null;
  /** Lowest checked UI pair ratio at display precision; null when every UI pair was skipped. */
  worstUiRatio: number | null;
}

function worstRatio(pairs: readonly AaGatePairResult[], kind: 'text' | 'ui'): number | null {
  let worst: number | null = null;
  for (const pair of pairs) {
    if (pair.kind !== kind) continue;
    if (pair.skipped || pair.ratio === null) continue;
    if (worst === null || pair.ratio < worst) worst = pair.ratio;
  }
  return worst;
}

/**
 * The ratio as the card prints it. Full float precision cost the gallery's
 * card list 4 KB gzip; `formatRatio` of this value prints the same text.
 */
function displayRatio(ratio: number | null): number | null {
  return ratio === null ? null : Number(ratio.toFixed(1));
}

/** Reduce one mode report to the fields the gallery cards show. */
export function summarizeModeScore(mode: AaGateModeReport): GalleryModeScore {
  return {
    mode: mode.mode,
    pass: mode.pass,
    issueCount: mode.issueCount,
    checkedCount: mode.checkedCount,
    skippedCount: mode.skippedCount,
    worstTextRatio: displayRatio(worstRatio(mode.pairs, 'text')),
    worstUiRatio: displayRatio(worstRatio(mode.pairs, 'ui')),
  };
}

/** Reduce a full theme AA report to per-mode gallery scores. */
export function summarizeThemeScores(report: AaGateThemeReport): readonly GalleryModeScore[] {
  return report.modes.map(summarizeModeScore);
}

/** Format a ratio for display (one decimal), or an em dash when unknown. */
export function formatRatio(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  return ratio.toFixed(1);
}

/** Filter gallery cards by free text (id, name, category, collection, tags). */
export function filterGalleryCards<
  T extends {
    id: string;
    name: string;
    description: string;
    category: string;
    collection: string;
    tags: readonly string[];
  },
>(cards: readonly T[], query: string): readonly T[] {
  const q = query.trim().toLowerCase();
  if (!q) return cards;
  const words = q.split(/\s+/).filter(Boolean);
  return cards.filter((card) => {
    const hay = [card.id, card.name, card.description, card.category, card.collection, ...card.tags]
      .join(' ')
      .toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}

/** Optional pass filter: 'all' | 'pass' | 'fail'. */
export function filterGalleryByPass<T extends { pass: boolean }>(
  cards: readonly T[],
  filter: 'all' | 'pass' | 'fail'
): readonly T[] {
  if (filter === 'all') return cards;
  if (filter === 'pass') return cards.filter((c) => c.pass);
  return cards.filter((c) => !c.pass);
}
