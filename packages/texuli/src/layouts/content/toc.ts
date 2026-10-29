/** Heading levels a content table of contents can list (`h1` is the page title). */
export type TocLevel = 2 | 3 | 4 | 5 | 6;
export type TocHeading = Readonly<{ id?: string; text: string; level: TocLevel }>;
export type TocItem = Readonly<{ id: string; label: string; level: TocLevel }>;
/** A host-supplied table of contents entry; `id` names an element already on the page. */
export type TocEntry = TocItem;
export type BuildTocOptions = Readonly<{
  /**
   * Keep authored ids exactly as written: headings without an id, and repeats
   * of an id already listed, are left out instead of receiving a generated id.
   */
  preserveIds?: boolean;
}>;

/** The levels a content layout lists when the host chooses none. */
export const DEFAULT_TOC_LEVELS: readonly TocLevel[] = Object.freeze([2, 3]);

function isTocLevel(value: unknown): value is TocLevel {
  return value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

/**
 * Normalize a level list from a prop (`[2, 3, 4]`) or a layout option string
 * (`"2,3,4"`) or number (`2`). Unknown levels are dropped; an empty result falls back to
 * {@link DEFAULT_TOC_LEVELS}.
 */
export function resolveTocLevels(value: unknown): TocLevel[] {
  const raw: unknown[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',').map((part) => (part.trim() ? Number(part.trim()) : Number.NaN))
      : typeof value === 'number'
        ? [value]
        : [];
  const levels = [...new Set(raw.filter(isTocLevel))].sort((a, b) => a - b);
  return levels.length ? levels : [...DEFAULT_TOC_LEVELS];
}

/** A CSS selector matching the headings of the given levels (`h2, h3`). */
export function tocSelector(levels: readonly TocLevel[]): string {
  return levels.map((level) => `h${level}`).join(', ');
}

/** Create a stable fragment id from visible heading text. */
export function headingSlug(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'section';
}

/**
 * Preserve authored ids and make generated ids unique in document order. With
 * `preserveIds`, no id is generated or changed: id-less headings and repeated
 * ids are left out.
 */
export function buildToc(
  headings: readonly TocHeading[],
  options: BuildTocOptions = {}
): TocItem[] {
  const used = new Set<string>();
  const reserved = new Set(headings.map((heading) => heading.id?.trim()).filter(Boolean));
  return headings.flatMap((heading) => {
    const label = heading.text.trim().replace(/\s+/g, ' ');
    if (!label) return [];
    const authoredId = heading.id?.trim();
    if (options.preserveIds) {
      const id = heading.id;
      if (!authoredId || !id || used.has(id)) return [];
      used.add(id);
      return [{ id, label, level: heading.level }];
    }
    const base = authoredId || headingSlug(label);
    let id = base;
    let suffix = 2;
    while (used.has(id) || (!authoredId && reserved.has(id))) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return [{ id, label, level: heading.level }];
  });
}

/**
 * Clean host-supplied entries: trim labels, drop blank ids or labels and
 * repeated ids, and clamp an unknown level to 2. Ids are kept verbatim.
 */
export function normalizeTocEntries(entries: readonly TocEntry[]): TocItem[] {
  const used = new Set<string>();
  const items: TocItem[] = [];
  for (const entry of entries) {
    const id = typeof entry?.id === 'string' ? entry.id : '';
    const label = typeof entry?.label === 'string' ? entry.label.trim().replace(/\s+/g, ' ') : '';
    if (!id.trim() || !label || used.has(id)) continue;
    used.add(id);
    items.push({ id, label, level: isTocLevel(entry.level) ? entry.level : 2 });
  }
  return items;
}
