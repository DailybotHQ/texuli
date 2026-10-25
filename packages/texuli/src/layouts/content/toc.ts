export type TocHeading = Readonly<{ id?: string; text: string; level: 2 | 3 }>;
export type TocItem = Readonly<{ id: string; label: string; level: 2 | 3 }>;

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

/** Preserve authored ids and make generated ids unique in document order. */
export function buildToc(headings: readonly TocHeading[]): TocItem[] {
  const used = new Set<string>();
  const reserved = new Set(headings.map((heading) => heading.id?.trim()).filter(Boolean));
  return headings.flatMap((heading) => {
    const label = heading.text.trim().replace(/\s+/g, ' ');
    if (!label) return [];
    const authoredId = heading.id?.trim();
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
