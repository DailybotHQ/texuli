/**
 * The page's flagship deck: `texuli-create-anything`, the 25-slide fictional
 * starter deck of `@texuli/deck`. `flagship-source.json` is a verbatim copy of
 * `packages/deck/decks/texuli-create-anything.json` (the deck package exports
 * no `decks` subpath, and packages never deep-import each other's files);
 * `apps/website/tests/site-slides.test.ts` fails when the two drift.
 *
 * On the site the deck is adapted, never rewritten:
 *
 * - its `https://example.com/media/diagram.webp` images become the same-origin
 *   `media/texuli-mark.webp` (served by `pages/slides-page/media/[file].ts`
 *   from the brand assets), with alt text that says what is shown, so the
 *   page makes no request to another origin;
 * - the three video slides are `hidden`: the site ships no video file, and a
 *   hidden slide stays in the model (and in print and PPTX) but out of the
 *   presentation.
 */
import source from './flagship-source.json';

/** The same-origin image every adapted media slide shows (relative to /slides-page/). */
export const FLAGSHIP_IMAGE = 'media/texuli-mark.webp';
const FLAGSHIP_IMAGE_ALT = 'The Texuli mark: a rounded square of small tiles';
const REMOTE_IMAGE = 'https://example.com/media/diagram.webp';

type Bag = Record<string, unknown>;

const isBag = (value: unknown): value is Bag =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function adaptImages(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(adaptImages);
  if (!isBag(value)) return value;
  const out: Bag = {};
  for (const [key, item] of Object.entries(value)) out[key] = adaptImages(item);
  if (out.src === REMOTE_IMAGE) {
    out.src = FLAGSHIP_IMAGE;
    out.alt = FLAGSHIP_IMAGE_ALT;
    out.width = 512;
    out.height = 512;
  }
  return out;
}

/** Slide layouts that need a video file the site does not ship. */
const VIDEO_LAYOUTS = new Set(['video-centered', 'video-left', 'video-right']);

/** The flagship deck as the page presents it (a fresh copy on every call). */
export function flagshipDeck(): Bag {
  const deck = adaptImages(structuredClone(source)) as Bag & { slides: Bag[] };
  deck.slides = deck.slides.map((slide) =>
    VIDEO_LAYOUTS.has(String(slide.layout)) ? { ...slide, hidden: true } : slide
  );
  return deck;
}

/** The flagship's id in `@texuli/deck` (`packages/deck/decks/<id>.json`). */
export const FLAGSHIP_ID = 'texuli-create-anything';
