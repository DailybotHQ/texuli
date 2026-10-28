/**
 * The PPTX entry points. A model v1 deck goes through the v1 writer
 * (synchronous, text only, unchanged for its callers). A model v2 deck
 * (`formatVersion: 2`) goes through the v2 writer, which this module imports
 * on first use: the calls return promises, so the `@texuli/slides/export`
 * entry stays inside its size budget and hosts may answer `loadImage` and
 * `snapshotChart` asynchronously.
 */
import type { Deck as V2Deck } from '@texuli/deck/model';
import type { Deck as V1Deck } from '../model/index.ts';
import {
  buildDeckPptx as buildV1,
  type DeckPptxOmission as DeckPptxV1Omission,
  type DeckPptxOptions as DeckPptxV1Options,
  type DeckPptxPackage as DeckPptxV1Package,
  exportDeckPptx as exportV1,
  writeDeckPptx as writeV1,
} from './pptx-v1.ts';
import type {
  DeckPptxV2Export,
  DeckPptxV2Omission,
  DeckPptxV2Options,
  DeckPptxV2Package,
  DeckPptxV2Written,
} from './pptx-v2.ts';

export const PPTX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export { PPTX_SLIDE_SIZES } from './pptx-v1.ts';
export type {
  DeckPptxAssetContext,
  DeckPptxChartContext,
  DeckPptxImageAsset,
  DeckPptxImageMime,
  DeckPptxOmissionKind,
  DeckPptxV2Export,
  DeckPptxV2Media,
  DeckPptxV2Omission,
  DeckPptxV2Options,
  DeckPptxV2Package,
  DeckPptxV2Part,
  DeckPptxV2Written,
} from './pptx-v2.ts';
export type { DeckPptxV1Omission, DeckPptxV1Options, DeckPptxV1Package };

/** Options for either writer; the v1 writer reads only `notes`. */
export type DeckPptxOptions = DeckPptxV2Options;
/** A left-out item: v1 names the block type, v2 a kind and a reason. */
export type DeckPptxOmission = DeckPptxV1Omission | DeckPptxV2Omission;
export type DeckPptxPart = DeckPptxV1Package['parts'][number];
export type DeckPptxPackage = DeckPptxV1Package | DeckPptxV2Package;

function isV2(deck: V1Deck | V2Deck): deck is V2Deck {
  return (deck as { formatVersion?: unknown }).formatVersion === 2;
}

let writer: Promise<typeof import('./pptx-v2.ts')> | undefined;

/** Load the v2 writer (once). Hosts may call it early to warm the chunk. */
export function loadDeckPptxWriter(): Promise<typeof import('./pptx-v2.ts')> {
  writer ??= import('./pptx-v2.ts');
  return writer;
}

/** Build the PresentationML parts. v1: synchronous; v2: a promise. */
export function buildDeckPptx(deck: V1Deck, options?: DeckPptxV1Options): DeckPptxV1Package;
export function buildDeckPptx(
  deck: V2Deck,
  options?: DeckPptxV2Options
): Promise<DeckPptxV2Package>;
export function buildDeckPptx(
  deck: V1Deck | V2Deck,
  options: DeckPptxOptions = {}
): DeckPptxV1Package | Promise<DeckPptxV2Package> {
  if (isV2(deck))
    return loadDeckPptxWriter().then((module) => module.buildDeckPptxV2(deck, options));
  return buildV1(deck, { notes: options.notes });
}

/** Zip the parts into deterministic PPTX bytes. */
export function writeDeckPptx(
  deck: V1Deck,
  options?: DeckPptxV1Options
): { filename: string; bytes: Uint8Array; omitted: DeckPptxV1Omission[] };
export function writeDeckPptx(
  deck: V2Deck,
  options?: DeckPptxV2Options
): Promise<DeckPptxV2Written>;
export function writeDeckPptx(
  deck: V1Deck | V2Deck,
  options: DeckPptxOptions = {}
):
  | { filename: string; bytes: Uint8Array; omitted: DeckPptxV1Omission[] }
  | Promise<DeckPptxV2Written> {
  if (isV2(deck))
    return loadDeckPptxWriter().then((module) => module.writeDeckPptxV2(deck, options));
  return writeV1(deck, { notes: options.notes });
}

/** The PPTX as a Blob for a host download; nothing is uploaded. */
export function exportDeckPptx(
  deck: V1Deck,
  options?: DeckPptxV1Options
): { filename: string; blob: Blob; omitted: DeckPptxV1Omission[] };
export function exportDeckPptx(
  deck: V2Deck,
  options?: DeckPptxV2Options
): Promise<DeckPptxV2Export>;
export function exportDeckPptx(
  deck: V1Deck | V2Deck,
  options: DeckPptxOptions = {}
): { filename: string; blob: Blob; omitted: DeckPptxV1Omission[] } | Promise<DeckPptxV2Export> {
  if (isV2(deck))
    return loadDeckPptxWriter().then((module) => module.exportDeckPptxV2(deck, options));
  return exportV1(deck, { notes: options.notes });
}
