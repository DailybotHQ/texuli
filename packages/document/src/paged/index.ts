/**
 * @texuli/document/paged: the pagination engine (ADR-011). Page sizes,
 * orientation and margins resolved to points, explicit page breaks,
 * headings kept with what follows, widow and orphan control, and headers
 * and footers with page fields, over a measurer the caller injects (the
 * paged view measures the DOM, the PDF writer uses font metrics). Pure,
 * framework-free and DOM-free.
 */
export {
  DEFAULT_MARGINS,
  DEFAULT_PAGE_SETTINGS,
  MM,
  PAGE_PRESETS,
  type PageGeometry,
  type PageMargins,
  PX_PER_PT,
  pageGeometry,
} from './geometry.ts';
export {
  type BlockMeasurer,
  DEFAULT_FOOTER,
  documentPageSettings,
  type LaidOutPage,
  type LayoutOptions,
  layoutDocument,
  type PagedLayout,
  type ResolvedBand,
  resolveBandText,
} from './layout.ts';
export {
  type PagedPage,
  type PagedUnit,
  type PageSlice,
  type PaginateOptions,
  type Pagination,
  pagedUnits,
  paginate,
  type UnitMeasure,
} from './paginate.ts';
