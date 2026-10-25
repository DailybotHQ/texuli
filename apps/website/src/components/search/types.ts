/** One entry in the static site search index. */
export type SearchKind = 'page' | 'docs' | 'component' | 'theme' | 'example';

export type SearchEntry = {
  /** Stable id (also the command value). */
  id: string;
  /** Visible title. */
  title: string;
  /** One-line summary. */
  description: string;
  /** Site path relative to base (e.g. `/docs-shell/`). */
  href: string;
  kind: SearchKind;
  /** Extra tokens for matching (tags, package names). */
  keywords?: readonly string[];
};

export type SearchHit = SearchEntry & {
  /** Lower is better. */
  score: number;
};
