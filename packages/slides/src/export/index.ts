import type { Deck, DeckAspect } from '../model/index.ts';
import { deckExportFilename } from './filename.ts';

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

export type DeckPrintPage =
  | { kind: 'slide'; index: number; slideId: string; label: string }
  | { kind: 'notes'; index: number; slideId: string; label: string; notes: string | null };

/** Paper size for one slide page, from a closed table keyed by deck aspect. */
export interface DeckPrintPageSize {
  aspect: DeckAspect;
  /** CSS named page declared in `@texuli/slides/styles.css`. */
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

export const DECK_PRINT_PAGE_SIZES: Readonly<Record<DeckAspect, DeckPrintPageSize>> = Object.freeze(
  {
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
  }
);

/** Order the printable pages for a validated deck. The deck is not mutated. */
export function planDeckPrint(deck: Deck, options: DeckPrintOptions = {}): DeckPrintPlan {
  const notes = options.notes ?? 'none';
  if (!(DECK_PRINT_NOTES as readonly unknown[]).includes(notes)) {
    throw new TypeError('Print notes must be none, appendix, or handout.');
  }
  const labelFor = (title: string | undefined, index: number) => title ?? `Slide ${index + 1}`;
  const slidePages: DeckPrintPage[] = deck.slides.map((slide, index) => ({
    kind: 'slide',
    index,
    slideId: slide.id,
    label: labelFor(slide.title, index),
  }));
  const notePages: DeckPrintPage[] = deck.slides.map((slide, index) => ({
    kind: 'notes',
    index,
    slideId: slide.id,
    label: labelFor(slide.title, index),
    notes: slide.notes ?? null,
  }));
  const pages =
    notes === 'none' ? slidePages : notes === 'handout' ? notePages : [...slidePages, ...notePages];
  return {
    title: deck.meta.title,
    filename: deckExportFilename(deck.meta.title),
    notes,
    pageSize: DECK_PRINT_PAGE_SIZES[deck.meta.aspect],
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
  type DeckPptxOmission,
  type DeckPptxOptions,
  type DeckPptxPackage,
  type DeckPptxPart,
  exportDeckPptx,
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
