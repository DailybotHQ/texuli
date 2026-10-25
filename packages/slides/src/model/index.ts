import type { Block } from '@texuli/blocks/core';
import { safeParseBlocks } from '@texuli/blocks/core';
import type { Theme } from '@texuli/tokens/contract';
import { defineTheme } from '@texuli/tokens/contract';
import type { ColorMode } from '@texuli/tokens/modes';
import { checkSlideFragments } from './fragments.ts';

export const DECK_LIMITS = Object.freeze({
  slides: 120,
  slideIdLength: 48,
  titleLength: 200,
  descriptionLength: 500,
  notesLength: 6_000,
  blocksPerSlide: 2_000,
});

export const DECK_ASPECTS = ['16:9', '4:3', '1:1'] as const;
export type DeckAspect = (typeof DECK_ASPECTS)[number];

export const SLIDE_MASTERS = [
  'title',
  'section',
  'content',
  'two-column',
  'media-left',
  'media-right',
  'quote',
  'closing',
] as const;
export type SlideMasterId = (typeof SLIDE_MASTERS)[number];

export type SlideMasterSlot =
  | 'title'
  | 'body'
  | 'contentStart'
  | 'contentEnd'
  | 'media'
  | 'quote'
  | 'attribution'
  | 'footer';

export type SlideMasterArrangement =
  | 'centered'
  | 'stack'
  | 'split'
  | 'media-start'
  | 'media-end'
  | 'quotation';

/** Resolved, built-in layout vocabulary. This describes slots, not rendered CSS. */
export interface SlideMasterLayout {
  id: SlideMasterId;
  arrangement: SlideMasterArrangement;
  slots: readonly SlideMasterSlot[];
}

function masterLayout<const Slots extends readonly SlideMasterSlot[]>(
  id: SlideMasterId,
  arrangement: SlideMasterArrangement,
  slots: Slots
): SlideMasterLayout {
  return Object.freeze({ id, arrangement, slots: Object.freeze([...slots]) });
}

export const SLIDE_MASTER_LAYOUTS: Readonly<Record<SlideMasterId, SlideMasterLayout>> =
  Object.freeze({
    title: masterLayout('title', 'centered', ['title', 'body', 'footer']),
    section: masterLayout('section', 'stack', ['title', 'body']),
    content: masterLayout('content', 'stack', ['title', 'body', 'footer']),
    'two-column': masterLayout('two-column', 'split', [
      'title',
      'contentStart',
      'contentEnd',
      'footer',
    ]),
    'media-left': masterLayout('media-left', 'media-start', ['title', 'media', 'body', 'footer']),
    'media-right': masterLayout('media-right', 'media-end', ['title', 'body', 'media', 'footer']),
    quote: masterLayout('quote', 'quotation', ['quote', 'attribution']),
    closing: masterLayout('closing', 'centered', ['title', 'body', 'footer']),
  });

/** Resolve a built-in slide layout; slides without a master use `content`. */
export function resolveSlideMaster(master: SlideMasterId = 'content'): SlideMasterLayout {
  return SLIDE_MASTER_LAYOUTS[master];
}

/**
 * Closed slide-entry transition tokens. `none` is a hard cut, the portable
 * fallback; `fade` and `fade-up` are web-only stage styling.
 */
export const DECK_TRANSITIONS = ['none', 'fade', 'fade-up'] as const;
export type DeckTransition = (typeof DECK_TRANSITIONS)[number];

export type DeckThemeMode = ColorMode;
export type DeckThemeReference =
  | { kind: 'catalog'; id: string; mode?: DeckThemeMode }
  | { kind: 'embedded'; theme: Theme; mode?: DeckThemeMode };

export interface DeckMetadata {
  title: string;
  description?: string;
  locale?: string;
  aspect: DeckAspect;
  themeRef?: DeckThemeReference;
}

export interface DeckSlide {
  id: string;
  title?: string;
  notes?: string;
  master?: SlideMasterId;
  themeRef?: DeckThemeReference;
  transition?: DeckTransition;
  blocks: Block[];
}

export interface DeckSettings {
  startIndex: number;
  loop: boolean;
  showProgress: boolean;
  defaultTransition: DeckTransition;
}

export interface Deck {
  meta: DeckMetadata;
  masters: SlideMasterId[];
  slides: DeckSlide[];
  settings: DeckSettings;
}

/** A slide theme overrides the deck theme; absent references inherit from the deck. */
export function resolveSlideTheme(
  deck: Pick<Deck, 'meta'>,
  slide: Pick<DeckSlide, 'themeRef'>
): DeckThemeReference | undefined {
  return slide.themeRef ?? deck.meta.themeRef;
}

/**
 * Effective slide-entry transition: the slide token, else the deck default.
 * Reduced motion always resolves to a hard cut.
 */
export function resolveSlideTransition(
  deck: Pick<Deck, 'settings'>,
  slide: Pick<DeckSlide, 'transition'>,
  options: { reducedMotion?: boolean } = {}
): DeckTransition {
  if (options.reducedMotion) return 'none';
  return slide.transition ?? deck.settings.defaultTransition;
}

function isTransition(value: unknown): value is DeckTransition {
  return (DECK_TRANSITIONS as readonly unknown[]).includes(value);
}

export interface DeckIssue {
  path: string;
  message: string;
}

export type DeckParseResult =
  | { success: true; deck: Deck; issues: [] }
  | { success: false; deck: null; issues: DeckIssue[] };

type PlainRecord = Record<string, unknown>;

function isRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(path: string, message: string): DeckParseResult {
  return { success: false, deck: null, issues: [{ path, message }] };
}

function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= DECK_LIMITS.slideIdLength &&
    /^[a-z][a-z0-9-]*$/.test(value)
  );
}

function plainText(
  value: unknown,
  path: string,
  limit: number,
  multiline = false
): string | DeckIssue {
  if (typeof value !== 'string') return { path, message: 'Expected text.' };
  if (value.length === 0) return { path, message: 'Text must not be empty.' };
  if ([...value].length > limit)
    return { path, message: `Text must be at most ${limit} characters.` };
  if (
    [...value].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return (
        codePoint <= 0x08 ||
        (codePoint >= 0x0b && codePoint <= 0x0c) ||
        (codePoint >= 0x0e && codePoint <= 0x1f) ||
        codePoint === 0x7f ||
        (codePoint >= 0x202a && codePoint <= 0x202e) ||
        (codePoint >= 0x2066 && codePoint <= 0x2069)
      );
    })
  ) {
    return { path, message: 'Text contains control or bidi override characters.' };
  }
  if (!multiline && /[\r\n]/.test(value)) return { path, message: 'Text must be a single line.' };
  return value;
}

function themeReference(value: unknown, path: string): DeckThemeReference | DeckIssue {
  if (typeof value === 'string') {
    return validId(value)
      ? { kind: 'catalog', id: value }
      : { path, message: 'Theme id must use lowercase letters, digits, or hyphens.' };
  }
  if (!isRecord(value)) return { path, message: 'Expected a catalog or embedded theme reference.' };
  const mode = value.mode;
  if (
    mode !== undefined &&
    mode !== 'light' &&
    mode !== 'dark' &&
    mode !== 'high-contrast' &&
    mode !== 'system'
  ) {
    return { path: `${path}.mode`, message: 'Theme mode is not supported.' };
  }
  const modeProp: { mode?: DeckThemeMode } =
    mode === undefined ? {} : { mode: mode as DeckThemeMode };
  if (value.kind === 'catalog') {
    if (!validId(value.id)) return { path: `${path}.id`, message: 'Theme id is invalid.' };
    return { kind: 'catalog', id: value.id, ...modeProp };
  }
  if (value.kind === 'embedded') {
    try {
      return { kind: 'embedded', theme: defineTheme(value.theme), ...modeProp };
    } catch (error) {
      return {
        path: `${path}.theme`,
        message: error instanceof Error ? error.message : 'Embedded theme is invalid.',
      };
    }
  }
  return { path: `${path}.kind`, message: 'Theme reference kind must be catalog or embedded.' };
}

function isIssue(value: unknown): value is DeckIssue {
  return isRecord(value) && typeof value.path === 'string' && typeof value.message === 'string';
}

function parseSettings(value: unknown, slideCount: number): DeckSettings | DeckIssue {
  if (value === undefined) {
    return { startIndex: 0, loop: false, showProgress: true, defaultTransition: 'fade' };
  }
  if (!isRecord(value)) return { path: 'settings', message: 'Expected a settings object.' };
  const startIndex = value.startIndex ?? 0;
  const loop = value.loop ?? false;
  const showProgress = value.showProgress ?? true;
  const defaultTransition =
    value.defaultTransition === undefined ? 'fade' : value.defaultTransition;
  if (
    !Number.isInteger(startIndex) ||
    (startIndex as number) < 0 ||
    (startIndex as number) >= slideCount
  ) {
    return { path: 'settings.startIndex', message: 'Start index must point to an existing slide.' };
  }
  if (typeof loop !== 'boolean') return { path: 'settings.loop', message: 'Expected a boolean.' };
  if (typeof showProgress !== 'boolean') {
    return { path: 'settings.showProgress', message: 'Expected a boolean.' };
  }
  if (!isTransition(defaultTransition)) {
    return {
      path: 'settings.defaultTransition',
      message: 'Transition must be none, fade, or fade-up.',
    };
  }
  return { startIndex: startIndex as number, loop, showProgress, defaultTransition };
}

/** Validate deck metadata, the built-in master vocabulary and existing block schemas. */
export function parseDeck(input: unknown): DeckParseResult {
  if (!isRecord(input)) return issue('$', 'Expected a deck object.');
  if (!isRecord(input.meta)) return issue('meta', 'Expected deck metadata.');

  const title = plainText(input.meta.title, 'meta.title', DECK_LIMITS.titleLength);
  if (isIssue(title)) return { success: false, deck: null, issues: [title] };
  const description =
    input.meta.description === undefined
      ? undefined
      : plainText(input.meta.description, 'meta.description', DECK_LIMITS.descriptionLength);
  if (description !== undefined && isIssue(description)) {
    return { success: false, deck: null, issues: [description] };
  }
  const locale = input.meta.locale;
  if (
    locale !== undefined &&
    (typeof locale !== 'string' || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale))
  ) {
    return issue('meta.locale', 'Locale must be a language tag such as en or en-GB.');
  }
  const aspect = input.meta.aspect ?? '16:9';
  if (!(DECK_ASPECTS as readonly unknown[]).includes(aspect)) {
    return issue('meta.aspect', 'Aspect must be 16:9, 4:3, or 1:1.');
  }
  let deckThemeRef: DeckThemeReference | undefined;
  if (input.meta.themeRef !== undefined) {
    const parsed = themeReference(input.meta.themeRef, 'meta.themeRef');
    if (isIssue(parsed)) return { success: false, deck: null, issues: [parsed] };
    deckThemeRef = parsed;
  }

  if (!Array.isArray(input.slides) || input.slides.length === 0) {
    return issue('slides', 'A deck must contain at least one slide.');
  }
  if (input.slides.length > DECK_LIMITS.slides) {
    return issue('slides', `A deck may contain at most ${DECK_LIMITS.slides} slides.`);
  }

  const mastersValue = input.masters ?? [];
  if (!Array.isArray(mastersValue)) return issue('masters', 'Expected a master id array.');
  const masters: SlideMasterId[] = [];
  const masterSet = new Set<string>();
  for (let index = 0; index < mastersValue.length; index += 1) {
    const master = mastersValue[index];
    if (!(SLIDE_MASTERS as readonly unknown[]).includes(master)) {
      return issue(`masters[${index}]`, 'Master id is not in the built-in master set.');
    }
    if (masterSet.has(master as string))
      return issue(`masters[${index}]`, 'Master ids must be unique.');
    masterSet.add(master as string);
    masters.push(master as SlideMasterId);
  }

  const slides: DeckSlide[] = [];
  const slideIds = new Set<string>();
  for (let index = 0; index < input.slides.length; index += 1) {
    const value = input.slides[index];
    const path = `slides[${index}]`;
    if (!isRecord(value)) return issue(path, 'Expected a slide object.');
    if (!validId(value.id)) return issue(`${path}.id`, 'Slide id is invalid.');
    if (slideIds.has(value.id)) return issue(`${path}.id`, 'Slide ids must be unique.');
    slideIds.add(value.id);

    let slideTitle: string | undefined;
    if (value.title !== undefined) {
      const parsed = plainText(value.title, `${path}.title`, DECK_LIMITS.titleLength);
      if (isIssue(parsed)) return { success: false, deck: null, issues: [parsed] };
      slideTitle = parsed;
    }
    let notes: string | undefined;
    if (value.notes !== undefined) {
      const parsed = plainText(value.notes, `${path}.notes`, DECK_LIMITS.notesLength, true);
      if (isIssue(parsed)) return { success: false, deck: null, issues: [parsed] };
      notes = parsed;
    }
    let master: SlideMasterId | undefined;
    if (value.master !== undefined) {
      if (!(SLIDE_MASTERS as readonly unknown[]).includes(value.master)) {
        return issue(`${path}.master`, 'Master id is not in the built-in master set.');
      }
      if (!masterSet.has(value.master as string)) {
        return issue(`${path}.master`, 'Master id must be declared in deck masters.');
      }
      master = value.master as SlideMasterId;
    }
    let themeRef: DeckThemeReference | undefined;
    if (value.themeRef !== undefined) {
      const parsed = themeReference(value.themeRef, `${path}.themeRef`);
      if (isIssue(parsed)) return { success: false, deck: null, issues: [parsed] };
      themeRef = parsed;
    }
    if (value.transition !== undefined && !isTransition(value.transition)) {
      return issue(`${path}.transition`, 'Transition must be none, fade, or fade-up.');
    }
    const transition = value.transition as DeckTransition | undefined;
    if (!Array.isArray(value.blocks) || value.blocks.length > DECK_LIMITS.blocksPerSlide) {
      return issue(
        `${path}.blocks`,
        `Blocks must be an array of at most ${DECK_LIMITS.blocksPerSlide} items.`
      );
    }
    const parsedBlocks = safeParseBlocks(value.blocks);
    if (!parsedBlocks.success) {
      const first = parsedBlocks.issues[0];
      return issue(
        `${path}.blocks${first ? `.${first.path.join('.')}` : ''}`,
        first?.message ?? 'Block data is invalid.'
      );
    }
    const fragmentIssue = checkSlideFragments(parsedBlocks.data);
    if (fragmentIssue) return issue(`${path}.blocks.${fragmentIssue.path}`, fragmentIssue.message);
    slides.push({
      id: value.id,
      ...(slideTitle !== undefined ? { title: slideTitle } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(master !== undefined ? { master } : {}),
      ...(themeRef !== undefined ? { themeRef } : {}),
      ...(transition !== undefined ? { transition } : {}),
      blocks: parsedBlocks.data,
    });
  }

  const settings = parseSettings(input.settings, slides.length);
  if (isIssue(settings)) return { success: false, deck: null, issues: [settings] };
  return {
    success: true,
    deck: {
      meta: {
        title,
        ...(description !== undefined ? { description } : {}),
        ...(locale !== undefined ? { locale } : {}),
        aspect: aspect as DeckAspect,
        ...(deckThemeRef !== undefined ? { themeRef: deckThemeRef } : {}),
      },
      masters,
      slides,
      settings,
    },
    issues: [],
  };
}

export {
  type ComposedSlide,
  composeSlide,
  isSlideMediaBlock,
  SLIDE_MEDIA_TYPES,
  SLIDE_REGION_FIT,
  type SlideMediaType,
  type SlideRegion,
} from './compose.ts';
export {
  blockFragment,
  checkSlideFragments,
  DECK_ENTRANCE_REVEALS,
  DECK_FRAGMENT_KINDS,
  DECK_MAX_SLIDE_STEPS,
  type DeckEntranceReveal,
  type DeckFragment,
  type DeckFragmentIssue,
  type DeckFragmentKind,
  type DeckFragmentView,
  fragmentView,
  isEntranceReveal,
  slideStepCount,
} from './fragments.ts';
