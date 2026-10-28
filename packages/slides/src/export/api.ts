import type { Deck as V2Deck, DeckSlide as V2Slide } from '@texuli/deck/model';
import type { Deck as V1Deck, DeckAspect as V1DeckAspect } from '../model/index.ts';
import { DECK_EXPORT_CANVAS, type DeckExportAspect, isDeckExportAspect } from './canvas.ts';
import { deckExportFilename } from './filename.ts';

/**
 * The export API without the print view component: print plans and flags,
 * the PDF seam, PPTX (v1 synchronous, v2 loaded on first use) and the owned
 * XML and ZIP writers. `index.ts` (the `@texuli/slides/export` entry) adds
 * `DeckPrintView`.
 */
export { DECK_EXPORT_CANVAS, type DeckExportAspect, PPTX_CANVAS_SLIDE_SIZES } from './canvas.ts';
export { deckExportFilename } from './filename.ts';

/**
 * How speaker notes print. `none` prints slides only; `appendix` adds a notes
 * section after the slides; `handout` prints titles and notes without slide
 * bodies.
 */
export const DECK_PRINT_NOTES = ['none', 'appendix', 'handout'] as const;
export type DeckPrintNotes = (typeof DECK_PRINT_NOTES)[number];

export interface DeckPrintOptions {
  notes?: DeckPrintNotes;
}

/** The print route's flags: `?print=1` prints, `?notes=1` adds the notes appendix. */
export interface DeckPrintFlags {
  print: boolean;
  notes: DeckPrintNotes;
}

export type DeckPrintPage =
  | { kind: 'slide'; index: number; slideId: string; label: string }
  | { kind: 'notes'; index: number; slideId: string; label: string; notes: string | null };

/** Paper size for one slide page, from a closed table keyed by deck aspect. */
export interface DeckPrintPageSize {
  aspect: DeckExportAspect;
  /** CSS named page (`@texuli/slides/styles.css` for v1, the print view for v2). */
  pageName: string;
  inlineSize: string;
  blockSize: string;
}

export interface DeckPrintPlan {
  title: string;
  filename: string;
  notes: DeckPrintNotes;
  pageSize: DeckPrintPageSize;
  pages: DeckPrintPage[];
}

/** Model v1 pages (the v1 print view and stylesheet). */
export const DECK_PRINT_PAGE_SIZES: Readonly<Record<V1DeckAspect, DeckPrintPageSize>> =
  Object.freeze({
    '16:9': Object.freeze({
      aspect: '16:9',
      pageName: 'tx-deck-16-9',
      inlineSize: '13.333in',
      blockSize: '7.5in',
    }),
    '4:3': Object.freeze({
      aspect: '4:3',
      pageName: 'tx-deck-4-3',
      inlineSize: '10in',
      blockSize: '7.5in',
    }),
    '1:1': Object.freeze({
      aspect: '1:1',
      pageName: 'tx-deck-1-1',
      inlineSize: '7.5in',
      blockSize: '7.5in',
    }),
  });

/**
 * Model v2 pages: exactly the deck canvas (1280 × 720 CSS pixels for 16:9),
 * so a slide prints at the size the stage paints it. Named pages are declared
 * by `DeckPrintView`.
 */
export const DECK_PRINT_CANVAS_PAGE_SIZES: Readonly<Record<DeckExportAspect, DeckPrintPageSize>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(DECK_EXPORT_CANVAS).map(([aspect, canvas]) => [
        aspect,
        Object.freeze({
          aspect: aspect as DeckExportAspect,
          pageName: `tx-deck-canvas-${aspect.replace(':', '-')}`,
          inlineSize: `${canvas.width}px`,
          blockSize: `${canvas.height}px`,
        }),
      ])
    ) as Record<DeckExportAspect, DeckPrintPageSize>
  );

function searchParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

/**
 * Read `?print=1&notes=1` (the engine's route flags: only the value `1`
 * counts). `notes=1` means the notes appendix; `handout` stays API-only.
 */
export function parseDeckPrintFlags(search: string): DeckPrintFlags {
  const params = searchParams(search);
  return {
    print: params.get('print') === '1',
    notes: params.get('notes') === '1' ? 'appendix' : 'none',
  };
}

/** The search string of the print route (`?print=1`, `?print=1&notes=1`). */
export function deckPrintSearch(options: { notes?: boolean } = {}): string {
  return options.notes ? '?print=1&notes=1' : '?print=1';
}

function isV2Deck(deck: V1Deck | V2Deck): deck is V2Deck {
  return (deck as { formatVersion?: unknown }).formatVersion === 2;
}

/** The title a v2 slide prints with: `slide.title`, else its layout's own `title` prop. */
export function deckSlideLabel(slide: V2Slide): string | undefined {
  if (slide.title) return slide.title;
  switch (slide.layout) {
    case 'free':
    case 'component':
    case 'custom':
    case 'image-full-bleed':
    case 'quote':
    case 'big-stat':
      return undefined;
    default:
      return slide.props.title;
  }
}

/**
 * Order the printable pages of a validated deck (v2, or legacy v1). v2 pages
 * are the visible slides (hidden ones are skipped) at the canvas size; every
 * reveal step prints in its final state. The deck is not mutated.
 */
export function planDeckPrint(
  deck: V1Deck | V2Deck,
  options: DeckPrintOptions = {}
): DeckPrintPlan {
  const notes = options.notes ?? 'none';
  if (!(DECK_PRINT_NOTES as readonly unknown[]).includes(notes)) {
    throw new TypeError('Print notes must be none, appendix, or handout.');
  }
  const printable: { slideId: string; index: number; label: string; notes: string | null }[] = [];
  let pageSize: DeckPrintPageSize;
  if (isV2Deck(deck)) {
    deck.slides.forEach((slide, index) => {
      if (slide.hidden === true) return;
      printable.push({
        slideId: slide.id,
        index,
        label: deckSlideLabel(slide) ?? `Slide ${printable.length + 1}`,
        notes: slide.notes ?? null,
      });
    });
    const aspect = isDeckExportAspect(deck.style?.aspect) ? deck.style.aspect : '16:9';
    pageSize = DECK_PRINT_CANVAS_PAGE_SIZES[aspect];
  } else {
    deck.slides.forEach((slide, index) => {
      printable.push({
        slideId: slide.id,
        index,
        label: slide.title ?? `Slide ${index + 1}`,
        notes: slide.notes ?? null,
      });
    });
    pageSize = DECK_PRINT_PAGE_SIZES[deck.meta.aspect];
  }
  const slidePages: DeckPrintPage[] = printable.map(({ slideId, index, label }) => ({
    kind: 'slide',
    index,
    slideId,
    label,
  }));
  const notePages: DeckPrintPage[] = printable.map(
    ({ slideId, index, label, notes: slideNotes }) => ({
      kind: 'notes',
      index,
      slideId,
      label,
      notes: slideNotes,
    })
  );
  const pages =
    notes === 'none' ? slidePages : notes === 'handout' ? notePages : [...slidePages, ...notePages];
  return {
    title: deck.meta.title,
    filename: deckExportFilename(deck.meta.title),
    notes,
    pageSize,
    pages,
  };
}

/**
 * A host-supplied PDF backend (for example tool-side rendering). It receives
 * the plan and returns the PDF bytes; nothing in this package uploads them.
 */
export type DeckPdfExporter = (plan: DeckPrintPlan) => Promise<Blob>;

export type DeckPdfResult =
  | { method: 'browser-print'; filename: string }
  | { method: 'exporter'; filename: string; blob: Blob };

export interface DeckPdfRequestOptions {
  exporter?: DeckPdfExporter;
  /** Browser print entry point; defaults to `globalThis.print`. */
  print?: () => void;
}

/**
 * Export a planned deck as PDF. With an exporter, its Blob must be a non-empty
 * `application/pdf`. Without one, the browser print dialog is the PDF path:
 * the user picks "Save as PDF", so this resolves once the dialog was requested.
 */
export async function requestDeckPdf(
  plan: DeckPrintPlan,
  options: DeckPdfRequestOptions = {}
): Promise<DeckPdfResult> {
  if (options.exporter) {
    const blob = await options.exporter(plan);
    if (!(blob instanceof Blob) || blob.type !== 'application/pdf' || blob.size === 0) {
      throw new TypeError('The PDF exporter must return a non-empty application/pdf Blob.');
    }
    return { method: 'exporter', filename: plan.filename, blob };
  }
  const print = options.print ?? (globalThis as { print?: () => void }).print;
  if (typeof print !== 'function') {
    throw new Error('Browser print is unavailable; supply a PDF exporter.');
  }
  print.call(globalThis);
  return { method: 'browser-print', filename: plan.filename };
}

export {
  buildDeckPptx,
  type DeckPptxAssetContext,
  type DeckPptxChartContext,
  type DeckPptxImageAsset,
  type DeckPptxOmission,
  type DeckPptxOmissionKind,
  type DeckPptxOptions,
  type DeckPptxPackage,
  type DeckPptxPart,
  type DeckPptxV2Export,
  type DeckPptxV2Omission,
  type DeckPptxV2Options,
  type DeckPptxV2Package,
  exportDeckPptx,
  loadDeckPptxWriter,
  PPTX_MIME_TYPE,
  PPTX_SLIDE_SIZES,
  writeDeckPptx,
} from './pptx.ts';
export {
  el,
  escapeXmlAttribute,
  escapeXmlText,
  sanitizeXmlChars,
  serializeXml,
  type XmlAttributeValue,
  type XmlChild,
  type XmlElement,
  type XmlNode,
  type XmlText,
  xmlText,
} from './xml.ts';
export { crc32, writeZip, type ZipEntry } from './zip.ts';
