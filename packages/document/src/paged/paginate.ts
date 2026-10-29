/**
 * The pagination algorithm (ADR-011): a pure, greedy, linear layout of
 * measured top-level blocks onto pages. The view (DOM) or a writer (PDF
 * font metrics) measures; this module only places. It honors explicit page
 * breaks, keeps headings with what follows, splits text blocks at line
 * boundaries with widow and orphan control, and clips a block taller than
 * a page across pages as the last resort.
 */
import type { DocumentBlock, DocumentBlockType, TexuliDocument } from '../model/types.ts';

/** One top-level block as the paginator sees it. */
export interface PagedUnit {
  /** The block's persisted id. */
  id: string;
  /** Its index in `document.blocks`. */
  index: number;
  type: DocumentBlockType;
  /** Start a new page before this block (an explicit page break). */
  breakBefore: boolean;
  /** Stay on the page of the block that follows (headings). */
  keepWithNext: boolean;
  /** May split across pages at its line boundaries. */
  splittable: boolean;
}

/** A block's measured height, in the same unit as `contentHeight`. */
export interface UnitMeasure {
  height: number;
  /**
   * The bottom of each line from the block's top, ascending: the places a
   * split may happen. Omit it (or pass fewer than two) for a block that
   * never splits.
   */
  lines?: readonly number[];
}

export interface PaginateOptions {
  /** The content box height of a page. */
  contentHeight: number;
  /** Space between two blocks on one page (none at the top of a page). Default 0. */
  gap?: number;
  /** Lines of a split block kept at the bottom of a page. Default 2. */
  orphans?: number;
  /** Lines of a split block carried to the top of the next page. Default 2. */
  widows?: number;
  /** Stop after this many pages (default 5,000); `truncated` says so. */
  maxPages?: number;
}

/** A block, or a part of a split block, on one page. */
export interface PageSlice {
  id: string;
  /** The unit index (the top-level block index). */
  index: number;
  /** The part of the block this slice shows: offsets from its top. */
  from: number;
  to: number;
  /** Where the slice starts in the page's content box. */
  top: number;
  /** The slice continues a block from the previous page. */
  continued: boolean;
  /** The block continues on the next page. */
  continues: boolean;
  /** The split ignored line boundaries: the block was taller than a page and could not split at lines. */
  clipped: boolean;
}

export interface PagedPage {
  /** 1-based. */
  number: number;
  slices: PageSlice[];
}

export interface Pagination {
  pages: PagedPage[];
  /** `maxPages` stopped the layout; the rest of the document is not placed. */
  truncated: boolean;
}

const SPLITTABLE: ReadonlySet<DocumentBlockType> = new Set([
  'paragraph',
  'code',
  'list',
  'quote',
  'callout',
  'toggle',
]);

/** Units for a document's top-level blocks: explicit breaks from `page.breaks`, headings kept with next. */
export function pagedUnits(doc: TexuliDocument): PagedUnit[] {
  const breaks = new Set(doc.page?.breaks ?? []);
  return doc.blocks.map((block: DocumentBlock, index) => ({
    id: block.id,
    index,
    type: block.type,
    breakBefore: index > 0 && breaks.has(block.id),
    keepWithNext: block.type === 'heading',
    // A wrapped table splits between rows; other wrapped blocks (charts, cards) never split.
    splittable: SPLITTABLE.has(block.type) || (block.type === 'block' && block.block === 'table'),
  }));
}

const count = (value: number | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;

function cleanLines(measure: UnitMeasure, height: number): number[] {
  const out: number[] = [];
  let last = 0;
  for (const line of measure.lines ?? []) {
    if (typeof line !== 'number' || !Number.isFinite(line) || line <= last) continue;
    if (line >= height) break;
    out.push(line);
    last = line;
  }
  // The last line ends at the block's bottom.
  if (out.length > 0) out.push(height);
  return out;
}

/** Lay measured units onto pages. Linear in units and lines. */
export function paginate(
  units: readonly PagedUnit[],
  measures: readonly UnitMeasure[],
  options: PaginateOptions
): Pagination {
  const H = Math.max(1, Number.isFinite(options.contentHeight) ? options.contentHeight : 1);
  const gap = Math.max(0, Number.isFinite(options.gap ?? 0) ? (options.gap ?? 0) : 0);
  const orphans = count(options.orphans, 2);
  const widows = count(options.widows, 2);
  const maxPages = count(options.maxPages, 5_000);
  const pages: PagedPage[] = [];
  let slices: PageSlice[] = [];
  let y = 0;
  let truncated = false;

  const heightOf = (index: number) => {
    const height = measures[index]?.height ?? 0;
    return Number.isFinite(height) && height > 0 ? height : 0;
  };
  const flush = () => {
    if (pages.length >= maxPages) {
      truncated = true;
      return;
    }
    pages.push({ number: pages.length + 1, slices });
    slices = [];
    y = 0;
  };
  const place = (
    unit: PagedUnit,
    from: number,
    to: number,
    continues: boolean,
    clipped = false
  ) => {
    const top = slices.length > 0 ? y + gap : 0;
    slices.push({
      id: unit.id,
      index: unit.index,
      from,
      to,
      top,
      continued: from > 0,
      continues,
      clipped,
    });
    y = top + (to - from);
  };
  /** The height the next blocks need on this page to keep a heading with them. */
  const lead = (index: number, depth: number): number => {
    const next = units[index];
    if (!next || next.breakBefore || depth > 3) return 0;
    const height = heightOf(index);
    if (next.keepWithNext) return gap + height + lead(index + 1, depth + 1);
    const lines = next.splittable ? cleanLines(measures[index] ?? { height }, height) : [];
    const first = lines.length > orphans + widows - 1 ? (lines[orphans - 1] as number) : height;
    return gap + Math.min(first, H);
  };

  for (let i = 0; i < units.length && !truncated; i += 1) {
    const unit = units[i] as PagedUnit;
    const h = heightOf(i);
    if (unit.breakBefore && slices.length > 0) flush();
    if (unit.keepWithNext && slices.length > 0 && y + gap + h + lead(i + 1, 0) > H) flush();
    if (truncated) break;
    const gapBefore = slices.length > 0 ? gap : 0;
    if (y + gapBefore + h <= H) {
      place(unit, 0, h, false);
      continue;
    }
    const lines = unit.splittable ? cleanLines(measures[i] ?? { height: h }, h) : [];
    if (lines.length >= 2) {
      let from = 0;
      let next = 0; // index of the first line not yet placed
      while (!truncated) {
        const before = slices.length > 0 ? gap : 0;
        const room = H - y - before;
        if (h - from <= room) {
          place(unit, from, h, false);
          break;
        }
        let j = next;
        while (j < lines.length && (lines[j] as number) - from <= room) j += 1;
        // Carry at least `widows` lines to the next page.
        if (lines.length - j < widows) j = Math.max(next, lines.length - widows);
        const k = j - next;
        if (k >= orphans || (k >= 1 && slices.length === 0)) {
          const to = lines[j - 1] as number;
          place(unit, from, to, true);
          flush();
          from = to;
          next = j;
          continue;
        }
        if (slices.length > 0) {
          flush();
          continue;
        }
        // An empty page that cannot hold one line: clip.
        const to = Math.min(h, from + room);
        place(unit, from, to, to < h, true);
        if (to >= h) break;
        flush();
        from = to;
        while (next < lines.length && (lines[next] as number) <= from) next += 1;
      }
      continue;
    }
    if (slices.length > 0) flush();
    if (truncated) break;
    if (h <= H) {
      place(unit, 0, h, false);
      continue;
    }
    // A block taller than a page that cannot split at lines: clip it across pages.
    let from = 0;
    while (!truncated) {
      const to = Math.min(h, from + H);
      place(unit, from, to, to < h, true);
      if (to >= h) break;
      flush();
      from = to;
    }
  }
  if (!truncated && (slices.length > 0 || pages.length === 0)) flush();
  return { pages, truncated };
}
