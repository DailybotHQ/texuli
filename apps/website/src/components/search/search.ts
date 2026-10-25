import { SEARCH_INDEX } from './index-data.ts';
import type { SearchEntry, SearchHit, SearchKind } from './types.ts';

const KIND_BOOST: Record<SearchKind, number> = {
  page: 0,
  docs: 1,
  component: 2,
  example: 3,
  theme: 4,
};

function normalize(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function tokens(query: string): string[] {
  return normalize(query)
    .split(/[\s/_.-]+/)
    .filter((part) => part.length > 0);
}

/**
 * Rank a single entry against query tokens. Lower score is better.
 * Returns `null` when the entry does not match.
 */
export function scoreEntry(entry: SearchEntry, queryTokens: readonly string[]): number | null {
  if (queryTokens.length === 0) return KIND_BOOST[entry.kind];
  const title = entry.title.toLowerCase();
  const description = entry.description.toLowerCase();
  const id = entry.id.toLowerCase();
  const href = entry.href.toLowerCase();
  const keywords = (entry.keywords ?? []).map((k) => k.toLowerCase());
  let score = KIND_BOOST[entry.kind];
  for (const token of queryTokens) {
    if (title === token) {
      score += 0;
      continue;
    }
    if (title.startsWith(token)) {
      score += 1;
      continue;
    }
    if (title.includes(token)) {
      score += 2;
      continue;
    }
    if (id.includes(token) || href.includes(token)) {
      score += 3;
      continue;
    }
    if (keywords.some((k) => k.includes(token))) {
      score += 4;
      continue;
    }
    if (description.includes(token)) {
      score += 5;
      continue;
    }
    return null;
  }
  return score;
}

export type SearchOptions = {
  /** Maximum hits to return (default 40). */
  limit?: number;
  /** Restrict to these kinds. */
  kinds?: readonly SearchKind[];
  /** Corpus override (tests). */
  index?: readonly SearchEntry[];
};

/**
 * Search the static index. Pure and sync — safe for the command palette.
 */
export function searchSiteIndex(query: string, options: SearchOptions = {}): SearchHit[] {
  const limit = Math.max(1, Math.min(options.limit ?? 40, 100));
  const index = options.index ?? SEARCH_INDEX;
  const kinds = options.kinds ? new Set(options.kinds) : null;
  const queryTokens = tokens(query);
  const hits: SearchHit[] = [];
  for (const entry of index) {
    if (kinds && !kinds.has(entry.kind)) continue;
    const score = scoreEntry(entry, queryTokens);
    if (score === null) continue;
    hits.push({ ...entry, score });
  }
  hits.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));
  return hits.slice(0, limit);
}

/** Recent defaults when the palette opens with an empty query. */
export function defaultRecentEntries(index: readonly SearchEntry[] = SEARCH_INDEX): SearchEntry[] {
  const prefer = [
    'page-home',
    'page-search',
    'page-foundation',
    'component-button',
    'component-command',
    'docs-/docs-shell/',
  ];
  const byId = new Map(index.map((e) => [e.id, e]));
  const recent: SearchEntry[] = [];
  for (const id of prefer) {
    const hit = byId.get(id);
    if (hit) recent.push(hit);
  }
  if (recent.length >= 4) return recent.slice(0, 6);
  for (const entry of index) {
    if (recent.some((r) => r.id === entry.id)) continue;
    if (entry.kind === 'page' || entry.kind === 'docs') recent.push(entry);
    if (recent.length >= 6) break;
  }
  return recent;
}
