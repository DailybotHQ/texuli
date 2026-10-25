import type { Block, BlockType } from '@texuli/blocks/core';
import { safeParseBlock } from '@texuli/blocks/core';
import { CHART_KINDS, isExtendedChartKind } from '@texuli/blocks/data/engine';
import type { ContentManifestId } from '@texuli/catalog/manifests/content';
import { DECK_GRAMMAR_IDS } from '@texuli/catalog/render/grammar';
import {
  DECK_ASPECTS,
  type Deck,
  type DeckParseResult,
  type DeckThemeReference,
  type DeckTransition,
  parseDeck,
  type SlideMasterId,
} from '../model/index.ts';

export const DECK_ROOT_CATALOG_ID = DECK_GRAMMAR_IDS.deck;
/** Catalog id of one slide in the render tree form (G11). */
export const DECK_SLIDE_CATALOG_ID = DECK_GRAMMAR_IDS.slide;

export const BLOCK_CATALOG_IDS = {
  heading: 'blocks-text',
  text: 'blocks-text',
  list: 'blocks-text',
  quote: 'blocks-text',
  callout: 'blocks-text',
  code: 'blocks-code',
  cta: 'blocks-structure',
  columns: 'blocks-structure',
  tabs: 'blocks-structure',
  accordion: 'blocks-structure',
  cards: 'blocks-structure',
  grid: 'blocks-structure',
  divider: 'blocks-structure',
  image: 'blocks-media',
  figure: 'blocks-media',
  video: 'blocks-media',
  gallery: 'blocks-media',
  table: 'blocks-data',
  stat: 'blocks-data',
  kpi: 'blocks-data',
  chart: 'blocks-data',
  poll: 'blocks-interactive',
  quiz: 'blocks-interactive',
  calculator: 'blocks-interactive',
  checklist: 'blocks-interactive',
} as const satisfies Record<BlockType, ContentManifestId>;

export type DeckBlockCatalogId = (typeof BLOCK_CATALOG_IDS)[BlockType];

export const DECK_BLOCK_CATALOG_IDS: readonly DeckBlockCatalogId[] = Object.freeze([
  ...new Set(Object.values(BLOCK_CATALOG_IDS)),
]);

export function catalogIdForBlock(type: BlockType): DeckBlockCatalogId {
  return BLOCK_CATALOG_IDS[type];
}

export interface DeckGrammarBlockNode {
  id: DeckBlockCatalogId;
  props: { block: Block };
}

export interface DeckGrammarSlide {
  id: string;
  title?: string;
  notes?: string;
  master?: SlideMasterId;
  themeRef?: DeckThemeReference;
  transition?: DeckTransition;
  children: DeckGrammarBlockNode[];
}

export interface DeckGrammar {
  id: typeof DECK_ROOT_CATALOG_ID;
  props: {
    title: string;
    description?: string;
    locale?: string;
    aspect: Deck['meta']['aspect'];
    themeRef?: DeckThemeReference;
    masters: Deck['masters'];
    settings: Deck['settings'];
    slides: DeckGrammarSlide[];
  };
}

/** Encode the single preferred layout-deck + structured slides[] grammar. */
export function toDeckGrammar(deck: Deck): DeckGrammar {
  return {
    id: DECK_ROOT_CATALOG_ID,
    props: {
      title: deck.meta.title,
      ...(deck.meta.description !== undefined ? { description: deck.meta.description } : {}),
      ...(deck.meta.locale !== undefined ? { locale: deck.meta.locale } : {}),
      aspect: deck.meta.aspect,
      ...(deck.meta.themeRef !== undefined ? { themeRef: deck.meta.themeRef } : {}),
      masters: deck.masters,
      settings: deck.settings,
      slides: deck.slides.map((slide) => ({
        id: slide.id,
        ...(slide.title !== undefined ? { title: slide.title } : {}),
        ...(slide.notes !== undefined ? { notes: slide.notes } : {}),
        ...(slide.master !== undefined ? { master: slide.master } : {}),
        ...(slide.themeRef !== undefined ? { themeRef: slide.themeRef } : {}),
        ...(slide.transition !== undefined ? { transition: slide.transition } : {}),
        children: slide.blocks.map((block) => ({
          id: BLOCK_CATALOG_IDS[block.type],
          props: { block },
        })),
      })),
    },
  };
}

function parseBlockNode(node: unknown, path: string): Block | DeckParseResult {
  if (!isRecord(node)) return failure(path, 'Expected a catalog content node.');
  if (
    typeof node.id !== 'string' ||
    !(DECK_BLOCK_CATALOG_IDS as readonly string[]).includes(node.id)
  ) {
    return failure(`${path}.id`, 'Catalog id is not a supported deck block family.');
  }
  if (!isRecord(node.props) || !('block' in node.props)) {
    return failure(`${path}.props`, 'Deck block nodes need a block prop.');
  }
  const parsed = safeParseBlock(node.props.block);
  if (!parsed.success) {
    return failure(`${path}.props.block`, parsed.issues[0]?.message ?? 'Block is invalid.');
  }
  if (BLOCK_CATALOG_IDS[parsed.data.type] !== node.id) {
    return failure(`${path}.id`, 'Catalog family does not match the block type.');
  }
  return parsed.data;
}

/** Decode the preferred structured slides[] layout-deck grammar. */
export function parseDeckGrammar(input: unknown): DeckParseResult {
  if (!isRecord(input) || input.id !== DECK_ROOT_CATALOG_ID) {
    return failure('$', 'Expected a layout-deck catalog node.');
  }
  const props = isRecord(input.props) ? input.props : {};
  if (!Array.isArray(props.slides) || props.slides.length === 0) {
    return failure('props.slides', 'A deck grammar needs a non-empty slides array.');
  }
  if (input.children !== undefined) {
    return failure('children', 'Canonical layout-deck grammar uses slides[] without children.');
  }

  const slides: UnknownRecord[] = [];
  for (let index = 0; index < props.slides.length; index += 1) {
    const value = props.slides[index];
    const path = `props.slides[${index}]`;
    if (!isRecord(value)) return failure(path, 'Expected a slide object.');
    if (!Array.isArray(value.children)) {
      return failure(`${path}.children`, 'Expected the slide block nodes array.');
    }
    const blocks: Block[] = [];
    for (let childIndex = 0; childIndex < value.children.length; childIndex += 1) {
      const childPath = `${path}.children[${childIndex}]`;
      const parsed = parseBlockNode(value.children[childIndex], childPath);
      if ('success' in parsed) return parsed;
      blocks.push(parsed);
    }
    slides.push({
      id: value.id,
      ...(value.title !== undefined ? { title: value.title } : {}),
      ...(value.notes !== undefined ? { notes: value.notes } : {}),
      ...(value.master !== undefined ? { master: value.master } : {}),
      ...(value.themeRef !== undefined ? { themeRef: value.themeRef } : {}),
      ...(value.transition !== undefined ? { transition: value.transition } : {}),
      blocks,
    });
  }
  return parseDeck({
    meta: {
      title: props.title,
      ...(props.description !== undefined ? { description: props.description } : {}),
      ...(props.locale !== undefined ? { locale: props.locale } : {}),
      aspect: props.aspect,
      ...(props.themeRef !== undefined ? { themeRef: props.themeRef } : {}),
    },
    ...(props.masters !== undefined ? { masters: props.masters } : {}),
    ...(props.settings !== undefined ? { settings: props.settings } : {}),
    slides,
  });
}

/** A plain catalog tree node, the shape `renderCatalogTree` accepts. */
export interface DeckRenderTreeNode {
  id: string;
  props: Record<string, unknown>;
  children?: DeckRenderTreeNode[];
}

/**
 * Encode a deck as a catalog render tree: `layout-deck` with one `deck-slide`
 * child per slide and the slide's blocks as block-family children. The
 * catalog renderer validates every node, and the composition grammar checks
 * the deck outline the same way it checks a report.
 */
export function toDeckRenderTree(deck: Deck): DeckRenderTreeNode {
  return {
    id: DECK_ROOT_CATALOG_ID,
    props: {
      title: deck.meta.title,
      ...(deck.meta.description !== undefined ? { description: deck.meta.description } : {}),
      ...(deck.meta.locale !== undefined ? { locale: deck.meta.locale } : {}),
      aspect: deck.meta.aspect,
      ...(deck.meta.themeRef !== undefined ? { themeRef: deck.meta.themeRef } : {}),
      masters: deck.masters,
      settings: deck.settings,
    },
    children: deck.slides.map((slide) => ({
      id: DECK_SLIDE_CATALOG_ID,
      props: {
        slideId: slide.id,
        ...(slide.title !== undefined ? { title: slide.title } : {}),
        ...(slide.notes !== undefined ? { notes: slide.notes } : {}),
        ...(slide.master !== undefined ? { master: slide.master } : {}),
        ...(slide.transition !== undefined ? { transition: slide.transition } : {}),
        ...(slide.themeRef !== undefined ? { themeRef: slide.themeRef } : {}),
      },
      children: slide.blocks.map((block) => ({
        id: BLOCK_CATALOG_IDS[block.type],
        props: { block },
      })),
    })),
  };
}

/**
 * Decode the render tree form back into a validated deck. Slides may hold
 * block-family nodes or supported `charts-*` nodes; the root must not also
 * carry `slides[]`, so a deck has exactly one encoding.
 */
export function parseDeckRenderTree(input: unknown): DeckParseResult {
  if (!isRecord(input) || input.id !== DECK_ROOT_CATALOG_ID) {
    return failure('$', 'Expected a layout-deck catalog node.');
  }
  const props = isRecord(input.props) ? input.props : {};
  if (props.slides !== undefined) {
    return failure('props.slides', 'The render tree form uses deck-slide children, not slides[].');
  }
  if (!Array.isArray(input.children) || input.children.length === 0) {
    return failure('children', 'A deck render tree needs deck-slide children.');
  }

  const slides: UnknownRecord[] = [];
  for (let index = 0; index < input.children.length; index += 1) {
    const node = input.children[index];
    const path = `children[${index}]`;
    if (!isRecord(node) || node.id !== DECK_SLIDE_CATALOG_ID) {
      return failure(path, 'Deck render tree children must be deck-slide nodes.');
    }
    const slideProps = isRecord(node.props) ? node.props : {};
    const children = node.children ?? [];
    if (!Array.isArray(children)) return failure(`${path}.children`, 'Expected block nodes.');
    const blocks: Block[] = [];
    for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
      const child = children[childIndex];
      const childPath = `${path}.children[${childIndex}]`;
      const parsed =
        isRecord(child) && typeof child.id === 'string' && child.id.startsWith('charts-')
          ? catalogChart(child, childPath)
          : parseBlockNode(child, childPath);
      if ('success' in parsed) return parsed;
      blocks.push(parsed);
    }
    slides.push({
      id: slideProps.slideId,
      ...(slideProps.title !== undefined ? { title: slideProps.title } : {}),
      ...(slideProps.notes !== undefined ? { notes: slideProps.notes } : {}),
      ...(slideProps.master !== undefined ? { master: slideProps.master } : {}),
      ...(slideProps.transition !== undefined ? { transition: slideProps.transition } : {}),
      ...(slideProps.themeRef !== undefined ? { themeRef: slideProps.themeRef } : {}),
      blocks,
    });
  }
  const result = parseDeck({
    meta: {
      title: props.title,
      ...(props.description !== undefined ? { description: props.description } : {}),
      ...(props.locale !== undefined ? { locale: props.locale } : {}),
      ...(props.aspect !== undefined ? { aspect: props.aspect } : {}),
      ...(props.themeRef !== undefined ? { themeRef: props.themeRef } : {}),
    },
    ...(props.masters !== undefined ? { masters: props.masters } : {}),
    ...(props.settings !== undefined ? { settings: props.settings } : {}),
    slides,
  });
  if (result.success) return result;
  return {
    success: false,
    deck: null,
    issues: result.issues.map((issue) => ({ ...issue, path: treePath(issue.path) })),
  };
}

/** Map a model issue path to the render tree node and prop it came from. */
function treePath(path: string): string {
  return path
    .replace(/^slides\[(\d+)\]\.id$/, 'children[$1].props.slideId')
    .replace(/^slides\[(\d+)\]\.blocks/, 'children[$1].children')
    .replace(/^slides\[(\d+)\]\./, 'children[$1].props.')
    .replace(/^slides$/, 'children')
    .replace(/^meta\./, 'props.')
    .replace(/^(masters|settings)/, 'props.$1');
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function failure(path: string, message: string): DeckParseResult {
  return { success: false, deck: null, issues: [{ path, message }] };
}

function catalogChart(node: UnknownRecord, path: string): Block | DeckParseResult {
  if (!isRecord(node.props)) return failure(`${path}.props`, 'Expected chart props.');
  const id = node.id;
  const kind =
    id === 'charts-cartesian'
      ? node.props.kind
      : typeof id === 'string'
        ? id.slice('charts-'.length)
        : '';
  if (typeof kind !== 'string' || !(CHART_KINDS as readonly string[]).includes(kind)) {
    return failure(
      `${path}.id`,
      'Legacy deck projection supports catalog chart kinds present in @texuli/blocks.'
    );
  }
  // Compact charts name themselves with `label`; blocks always use `title`.
  const titleKey = node.props.title === undefined ? 'label' : 'title';
  const { [titleKey]: title, description, kind: _kind, ...chartProps } = node.props;
  const parsed = safeParseBlock({
    type: 'chart',
    kind,
    title,
    description,
    ...(isExtendedChartKind(kind)
      ? { props: chartProps }
      : {
          ...(node.props.series !== undefined ? { series: node.props.series } : {}),
          ...(node.props.cells !== undefined ? { cells: node.props.cells } : {}),
          ...(node.props.points !== undefined ? { points: node.props.points } : {}),
        }),
  });
  return parsed.success
    ? parsed.data
    : failure(`${path}.props`, parsed.issues[0]?.message ?? 'Chart data is invalid.');
}

/**
 * Project the existing layout-deck → layout-card tree into slides. This keeps
 * g16-shaped decks valid while all new authored decks use `slides[]`.
 */
export function projectLegacyDeck(input: unknown): DeckParseResult {
  if (!isRecord(input) || input.id !== DECK_ROOT_CATALOG_ID) {
    return failure('$', 'Expected a layout-deck catalog node.');
  }
  const rootProps = isRecord(input.props) ? input.props : {};
  if (!Array.isArray(input.children) || input.children.length === 0) {
    return failure('children', 'Legacy deck projection needs layout-card children.');
  }

  const slides: UnknownRecord[] = [];
  for (let index = 0; index < input.children.length; index += 1) {
    const card = input.children[index];
    const path = `children[${index}]`;
    if (!isRecord(card) || card.id !== 'layout-card') {
      return failure(path, 'Legacy deck children must be layout-card nodes.');
    }
    const cardProps = isRecord(card.props) ? card.props : {};
    const children = Array.isArray(card.children) ? card.children : [];
    const blocks: Block[] = [];
    for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
      const child = children[childIndex];
      const childPath = `${path}.children[${childIndex}]`;
      if (!isRecord(child)) return failure(childPath, 'Expected a catalog content node.');
      let parsed: Block | DeckParseResult;
      if (typeof child.id === 'string' && child.id.startsWith('charts-')) {
        parsed = catalogChart(child, childPath);
      } else if (isRecord(child.props) && 'block' in child.props) {
        parsed = parseBlockNode(child, childPath);
      } else {
        return failure(
          childPath,
          'Legacy content nodes need a block prop or supported chart catalog id.'
        );
      }
      if ('success' in parsed) return parsed;
      blocks.push(parsed);
    }
    slides.push({
      id: `slide-${index + 1}`,
      ...(typeof cardProps.title === 'string' ? { title: cardProps.title } : {}),
      blocks,
    });
  }

  const deckInput = {
    meta: {
      title: rootProps.title,
      aspect:
        typeof rootProps.aspect === 'string' &&
        (DECK_ASPECTS as readonly string[]).includes(rootProps.aspect)
          ? rootProps.aspect
          : '16:9',
      ...(rootProps.themeRef !== undefined ? { themeRef: rootProps.themeRef } : {}),
    },
    slides,
    ...(rootProps.settings !== undefined ? { settings: rootProps.settings } : {}),
  };
  return parseDeck(deckInput);
}

export {
  type DeckDraftDiagnostic,
  type DeckDraftIssue,
  type DeckDraftResult,
  type ResolvedDeckSlide,
  type ValidateDeckDraftOptions,
  validateDeckDraft,
} from './agent.ts';
