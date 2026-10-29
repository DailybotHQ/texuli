/**
 * The paged layout of a document (ADR-011): page settings, the injected
 * measurer, pagination, and the resolved header and footer of every page.
 */
import type { DocumentBlock, PageBand, PageSettings, TexuliDocument } from '../model/types.ts';
import { DEFAULT_PAGE_SETTINGS, type PageGeometry, pageGeometry } from './geometry.ts';
import {
  type PagedPage,
  type PagedUnit,
  type PaginateOptions,
  pagedUnits,
  paginate,
  type UnitMeasure,
} from './paginate.ts';

/** A header or footer with its fields replaced. */
export interface ResolvedBand {
  start: string;
  center: string;
  end: string;
}

export interface LaidOutPage extends PagedPage {
  header: ResolvedBand | null;
  footer: ResolvedBand | null;
}

export interface PagedLayout {
  /** The settings the layout used (the document's, with overrides). */
  settings: PageSettings;
  geometry: PageGeometry;
  units: PagedUnit[];
  measures: UnitMeasure[];
  pages: LaidOutPage[];
  truncated: boolean;
}

/**
 * Measure one top-level block at the content width. The paged view
 * measures rendered elements; the PDF writer measures with font metrics.
 * Heights use the unit of `contentHeight` (points unless `scale` says otherwise).
 */
export type BlockMeasurer = (
  block: DocumentBlock,
  unit: PagedUnit,
  contentWidth: number
) => UnitMeasure;

export interface LayoutOptions extends Omit<PaginateOptions, 'contentHeight'> {
  /** Override the document's page settings (merged over `document.page`). */
  page?: Partial<PageSettings>;
  /**
   * Units per point for the measurer (default 1: points). The paged view
   * passes `PX_PER_PT` and measures in CSS pixels.
   */
  scale?: number;
  /** When the settings have no footer, number the pages (`{page} / {pages}` centered). Default true. */
  pageNumbers?: boolean;
}

/** The footer a document without one gets when page numbers are on. */
export const DEFAULT_FOOTER: Readonly<PageBand> = Object.freeze({ center: '{page} / {pages}' });

/** Page settings: the document's, with overrides merged over them. */
export function documentPageSettings(
  doc: Pick<TexuliDocument, 'page'>,
  overrides?: Partial<PageSettings>
): PageSettings {
  const base = doc.page ?? DEFAULT_PAGE_SETTINGS;
  const merged: PageSettings = { ...base, ...(overrides ?? {}) };
  // A preset chosen by the override drops the document's custom dimensions.
  if (overrides?.size !== undefined && overrides.size !== 'custom') {
    delete merged.width;
    delete merged.height;
  }
  return merged;
}

/** Replace `{page}`, `{pages}` and `{title}` in one pass; other text stays as is. */
export function resolveBandText(
  template: string | undefined,
  fields: { page: number; pages: number; title: string }
): string {
  if (!template) return '';
  return template.replace(/\{(pages|page|title)\}/g, (_, name: string) =>
    name === 'title' ? fields.title : String(name === 'page' ? fields.page : fields.pages)
  );
}

function band(
  value: PageBand | undefined,
  fields: { page: number; pages: number; title: string }
): ResolvedBand | null {
  if (!value || (!value.start && !value.center && !value.end)) return null;
  return {
    start: resolveBandText(value.start, fields),
    center: resolveBandText(value.center, fields),
    end: resolveBandText(value.end, fields),
  };
}

/** Lay a document out on pages with an injected measurer. */
export function layoutDocument(
  doc: TexuliDocument,
  measure: BlockMeasurer,
  options: LayoutOptions = {}
): PagedLayout {
  const settings = documentPageSettings(doc, options.page);
  const geometry = pageGeometry(settings);
  const scale =
    typeof options.scale === 'number' && Number.isFinite(options.scale) && options.scale > 0
      ? options.scale
      : 1;
  const units = pagedUnits({ ...doc, page: settings });
  const measures = units.map((unit) =>
    measure(doc.blocks[unit.index] as DocumentBlock, unit, geometry.contentWidth * scale)
  );
  const { pages, truncated } = paginate(units, measures, {
    contentHeight: geometry.contentHeight * scale,
    gap: options.gap,
    orphans: options.orphans,
    widows: options.widows,
    maxPages: options.maxPages,
  });
  const footer = settings.footer ?? (options.pageNumbers === false ? undefined : DEFAULT_FOOTER);
  const title = doc.meta.title;
  return {
    settings,
    geometry,
    units,
    measures,
    truncated,
    pages: pages.map((page) => {
      const fields = { page: page.number, pages: pages.length, title };
      return { ...page, header: band(settings.header, fields), footer: band(footer, fields) };
    }),
  };
}
