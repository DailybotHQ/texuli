/**
 * `validateDeckDraft`: catalog `validateDraft` at the host tier (default
 * `untrusted`) with `layout-deck` as the only frame root, then map the tree
 * to a Deck v2-shaped plain object (formatVersion 2).
 *
 * The catalog does not depend on `@texuli/deck` (owner-held package.json).
 * Mapping mirrors `migrateDeck` for grammar trees (`layout-deck` with
 * `deck-slide` / legacy `layout-card` children or a structured `slides[]`
 * prop). Hosts that have `@texuli/deck` should pass the result through
 * `migrateDeck` + `parseDeck` for full model validation:
 *
 * ```ts
 * const draft = validateDeckDraft(tree, { catalog });
 * if (draft.ok && draft.deck) {
 *   const migrated = migrateDeck(draft.deck);
 *   const parsed = parseDeck(migrated.deck);
 * }
 * ```
 *
 * Or inject `loadDeck` to run that pipeline inside this call.
 */

import {
  type DraftDiagnostic,
  type DraftValidation,
  type ValidateDraftOptions,
  validateDraft,
} from './draft.ts';

export const DECK_ROOT_CATALOG_ID = 'layout-deck' as const;
export const DECK_SLIDE_CATALOG_ID = 'deck-slide' as const;

export type DeckDraftIssueCode = 'deck-schema' | 'deck-legacy-cards' | 'deck-empty' | 'deck-loader';

export interface DeckDraftIssue {
  check: 'deck';
  code: DeckDraftIssueCode;
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export type DeckDraftDiagnostic = DraftDiagnostic | DeckDraftIssue;

/** A Deck v2-shaped plain object (unvalidated; pass to `@texuli/deck` parseDeck). */
export type DeckV2Plain = {
  formatVersion: 2;
  meta: {
    title: string;
    description?: string;
    locale?: string;
    dir?: string;
    author?: string;
    date?: string;
  };
  style?: Record<string, unknown>;
  navigation?: Record<string, unknown>;
  outline?: Record<string, unknown>;
  slides: readonly Record<string, unknown>[];
  [key: string]: unknown;
};

export interface DeckDraftResult {
  ok: boolean;
  status: DraftValidation['status'];
  draft: DraftValidation;
  /** V2-shaped deck, or null when catalog or deck mapping failed. */
  deck: DeckV2Plain | null;
  diagnostics: readonly DeckDraftDiagnostic[];
  /** True when legacy layout-card children were projected. */
  legacyCards: boolean;
}

export interface ValidateDeckDraftOptions extends Omit<ValidateDraftOptions, 'frameRoots'> {
  /**
   * Optional host loader: given the mapped v2 plain object (or the original
   * tree), return a fully validated deck or issues. Use `@texuli/deck`
   * `migrateDeck` + `parseDeck` when available.
   */
  loadDeck?: (input: { tree: unknown; mapped: DeckV2Plain }) => {
    deck: DeckV2Plain | null;
    issues?: readonly DeckDraftIssue[];
  };
}

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const points = Array.from(trimmed);
  return points.length > max ? points.slice(0, max).join('') : trimmed;
}

const INLINE_CHART_KINDS = new Set([
  'line',
  'area',
  'bar',
  'stacked-bar',
  'combo',
  'heatmap',
  'scatter',
  'bubble',
]);

function chartFromNode(id: string, props: Bag): Bag {
  const kind = id === 'charts-cartesian' ? props.kind : id.slice('charts-'.length);
  const titleKey = props.title === undefined ? 'label' : 'title';
  const { [titleKey]: title, description, kind: _kind, ...rest } = props;
  const block: Bag = { type: 'chart', kind, title, description };
  if (INLINE_CHART_KINDS.has(String(kind))) {
    for (const key of ['series', 'cells', 'points']) {
      if (props[key] !== undefined) block[key] = props[key];
    }
  } else {
    block.props = rest;
  }
  return block;
}

function itemFromNode(node: unknown): unknown {
  if (!isBag(node)) return node;
  const id = typeof node.id === 'string' ? node.id : '';
  const props = isBag(node.props) ? node.props : {};
  if (Object.hasOwn(props, 'block')) return props.block;
  if (id.startsWith('charts-')) return chartFromNode(id, props);
  return { type: 'component', component: id, props };
}

function slideFromGrammar(props: Bag, children: unknown, id: unknown): Bag {
  const out: Bag = { layout: 'free' };
  if (typeof id === 'string' && id.trim()) out.id = id;
  if (typeof props.title === 'string') out.title = props.title;
  if (typeof props.notes === 'string') out.notes = props.notes;
  if (typeof props.master === 'string') out.master = props.master;
  if (props.themeRef !== undefined) out.themeRef = props.themeRef;
  if (typeof props.transition === 'string') out.transition = props.transition;
  if (props.background !== undefined) out.background = props.background;
  if (Array.isArray(props.steps)) out.steps = props.steps;
  if (typeof props.layout === 'string' && props.layout !== 'free') {
    out.layout = props.layout;
    if (props.props !== undefined) out.props = props.props;
  }
  // Component / custom slide kinds
  if (props.layout === 'component' && isBag(props.component)) {
    out.layout = 'component';
    out.component = props.component;
  }
  if (props.layout === 'custom') {
    out.layout = 'custom';
    if (props.props !== undefined) out.props = props.props;
  }
  const nodes = Array.isArray(children) ? children : [];
  if (out.layout === 'free' || out.layout === undefined) {
    out.layout = out.layout ?? 'free';
    out.blocks = nodes.map((node) => itemFromNode(node));
  }
  return out;
}

/**
 * Map a layout-deck catalog tree to a Deck v2 plain object. Pure; never throws.
 * Returns null when the root is not a layout-deck or has no slides.
 */
export function layoutDeckToV2(input: unknown): {
  deck: DeckV2Plain | null;
  legacyCards: boolean;
  issues: DeckDraftIssue[];
} {
  const issues: DeckDraftIssue[] = [];
  if (!isBag(input) || input.id !== DECK_ROOT_CATALOG_ID) {
    return {
      deck: null,
      legacyCards: false,
      issues: [
        {
          check: 'deck',
          code: 'deck-schema',
          severity: 'error',
          path: '$',
          message: 'Expected a layout-deck catalog node.',
        },
      ],
    };
  }
  const props = isBag(input.props) ? input.props : {};
  const slides: Bag[] = [];
  let legacyCards = false;

  if (Array.isArray(props.slides) && props.slides.length > 0) {
    (props.slides as unknown[]).forEach((slide, i) => {
      const value = isBag(slide) ? slide : {};
      const id = typeof value.id === 'string' ? value.id : `slide-${i + 1}`;
      slides.push(slideFromGrammar(value, value.children, id));
    });
  } else if (Array.isArray(input.children) && input.children.length > 0) {
    const children = input.children as unknown[];
    legacyCards = children.every((child) => isBag(child) && child.id === 'layout-card');
    if (legacyCards) {
      issues.push({
        check: 'deck',
        code: 'deck-legacy-cards',
        severity: 'warning',
        path: 'children',
        message: `Legacy layout-card slides were projected; emit ${DECK_SLIDE_CATALOG_ID} children instead.`,
      });
    }
    children.forEach((node, i) => {
      const value = isBag(node) ? node : {};
      const nodeProps = isBag(value.props) ? value.props : {};
      if (value.id === 'layout-card') {
        slides.push(slideFromGrammar({ title: nodeProps.title }, value.children, `slide-${i + 1}`));
      } else {
        if (value.id !== DECK_SLIDE_CATALOG_ID) {
          issues.push({
            check: 'deck',
            code: 'deck-schema',
            severity: 'warning',
            path: `children[${i}]`,
            message: `Expected a ${DECK_SLIDE_CATALOG_ID} node; read it as one.`,
          });
        }
        const slideId =
          typeof nodeProps.slideId === 'string'
            ? nodeProps.slideId
            : typeof nodeProps.id === 'string'
              ? nodeProps.id
              : `slide-${i + 1}`;
        slides.push(slideFromGrammar(nodeProps, value.children, slideId));
      }
    });
  }

  if (slides.length === 0) {
    issues.push({
      check: 'deck',
      code: 'deck-empty',
      severity: 'error',
      path: 'slides',
      message: 'A deck needs at least one slide.',
    });
    return { deck: null, legacyCards, issues };
  }

  // Ensure every slide has an id
  const seen = new Set<string>();
  for (let i = 0; i < slides.length; i += 1) {
    const slide = slides[i];
    if (!slide) continue;
    let id = typeof slide.id === 'string' ? slide.id : `slide-${i + 1}`;
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) {
      id = `slide-${i + 1}`;
      issues.push({
        check: 'deck',
        code: 'deck-schema',
        severity: 'warning',
        path: `slides[${i}].id`,
        message: 'Slide id was rewritten to a lowercase slug.',
      });
    }
    if (seen.has(id)) {
      id = `${id}-${i + 1}`;
      issues.push({
        check: 'deck',
        code: 'deck-schema',
        severity: 'warning',
        path: `slides[${i}].id`,
        message: 'Duplicate slide id; a suffix was added.',
      });
    }
    seen.add(id);
    slide.id = id;
  }

  const title = clip(props.title, 200) ?? 'Untitled deck';
  const meta: DeckV2Plain['meta'] = { title };
  const description = clip(props.description, 500);
  if (description) meta.description = description;
  const locale = clip(props.locale, 35);
  if (locale) meta.locale = locale;
  if (typeof props.dir === 'string') meta.dir = props.dir;

  const deck: DeckV2Plain = {
    formatVersion: 2,
    meta,
    slides,
  };

  // style / navigation from structured props
  const style: Bag = {};
  if (typeof props.aspect === 'string') style.aspect = props.aspect;
  if (props.themeRef !== undefined) style.theme = props.themeRef;
  if (typeof props.transition === 'string') style.transition = props.transition;
  if (typeof props.motion === 'string') style.motion = props.motion;
  if (props.background !== undefined) style.background = props.background;
  if (Object.keys(style).length > 0) deck.style = style;

  if (isBag(props.settings)) {
    const navigation: Bag = {};
    if (typeof props.settings.loop === 'boolean') navigation.loop = props.settings.loop;
    if (typeof props.settings.autoSlideMs === 'number')
      navigation.autoSlideMs = props.settings.autoSlideMs;
    if (typeof props.settings.start === 'string') navigation.start = props.settings.start;
    if (Object.keys(navigation).length > 0) deck.navigation = navigation;
    if (typeof props.settings.defaultTransition === 'string' && !style.transition) {
      style.transition = props.settings.defaultTransition;
      deck.style = style;
    }
  }
  if (isBag(props.navigation)) deck.navigation = { ...props.navigation };
  if (isBag(props.style)) deck.style = { ...style, ...props.style };
  if (isBag(props.outline)) deck.outline = props.outline;
  if (Array.isArray(props.masters)) {
    // v1 masters list: kept for migrateDeck hosts; v2 free slides use master per slide
    (deck as Bag).masters = props.masters;
  }

  return { deck, legacyCards, issues };
}

/**
 * Encode a Deck v2 plain object (or anything with meta + slides) as a
 * layout-deck + deck-slide catalog tree. Pure; never throws.
 */
export function deckV2ToLayoutTree(deck: unknown): Bag | null {
  if (!isBag(deck)) return null;
  const meta = isBag(deck.meta) ? deck.meta : {};
  const slidesIn = Array.isArray(deck.slides) ? (deck.slides as unknown[]) : [];
  if (slidesIn.length === 0) return null;
  const style = isBag(deck.style) ? deck.style : {};
  const props: Bag = {
    title: typeof meta.title === 'string' ? meta.title : 'Untitled deck',
  };
  if (typeof meta.description === 'string') props.description = meta.description;
  if (typeof meta.locale === 'string') props.locale = meta.locale;
  if (typeof style.aspect === 'string') props.aspect = style.aspect;
  if (style.theme !== undefined) props.themeRef = style.theme;
  if (typeof style.transition === 'string') props.transition = style.transition;
  if (deck.navigation !== undefined) props.navigation = deck.navigation;
  if (deck.outline !== undefined) props.outline = deck.outline;

  const children = slidesIn.map((slide, i) => {
    const s = isBag(slide) ? slide : {};
    const slideProps: Bag = {
      slideId: typeof s.id === 'string' ? s.id : `slide-${i + 1}`,
    };
    if (typeof s.title === 'string') slideProps.title = s.title;
    if (typeof s.notes === 'string') slideProps.notes = s.notes;
    if (typeof s.master === 'string') slideProps.master = s.master;
    if (typeof s.transition === 'string') slideProps.transition = s.transition;
    if (s.themeRef !== undefined) slideProps.themeRef = s.themeRef;
    if (typeof s.layout === 'string') slideProps.layout = s.layout;
    if (s.props !== undefined) slideProps.props = s.props;
    if (s.component !== undefined) slideProps.component = s.component;
    if (s.background !== undefined) slideProps.background = s.background;
    if (Array.isArray(s.steps)) slideProps.steps = s.steps;

    const blocks = Array.isArray(s.blocks) ? (s.blocks as unknown[]) : [];
    const kids = blocks.map((block) => {
      if (!isBag(block)) return { id: 'blocks-text', props: { block } };
      if (block.type === 'component' && typeof block.component === 'string') {
        return {
          id: block.component,
          props: isBag(block.props) ? block.props : {},
        };
      }
      if (block.type === 'chart' && typeof block.kind === 'string') {
        return {
          id: `charts-${block.kind}`,
          props: { ...block, block: undefined },
        };
      }
      // Map common block types to catalog families
      const family =
        block.type === 'code'
          ? 'blocks-code'
          : block.type === 'image' || block.type === 'figure' || block.type === 'video'
            ? 'blocks-media'
            : block.type === 'table' || block.type === 'stat' || block.type === 'kpi'
              ? 'blocks-data'
              : block.type === 'poll' || block.type === 'quiz' || block.type === 'calculator'
                ? 'blocks-interactive'
                : block.type === 'columns' ||
                    block.type === 'tabs' ||
                    block.type === 'cta' ||
                    block.type === 'divider'
                  ? 'blocks-structure'
                  : 'blocks-text';
      return { id: family, props: { block } };
    });

    return {
      id: DECK_SLIDE_CATALOG_ID,
      props: slideProps,
      ...(kids.length > 0 ? { children: kids } : {}),
    };
  });

  return { id: DECK_ROOT_CATALOG_ID, props, children };
}

/**
 * Validate an agent deck draft: catalog rules at the host tier, then map to
 * Deck v2. Never throws.
 */
export function validateDeckDraft(
  input: unknown,
  options: ValidateDeckDraftOptions
): DeckDraftResult {
  const { loadDeck, ...draftOptions } = options;
  const draft = validateDraft(input, {
    ...draftOptions,
    frameRoots: [DECK_ROOT_CATALOG_ID],
  });
  const diagnostics: DeckDraftDiagnostic[] = [...draft.diagnostics];
  let deck: DeckV2Plain | null = null;
  let legacyCards = false;

  const tree = draft.draft;
  if (draft.ok && tree !== null && !Array.isArray(tree)) {
    const mapped = layoutDeckToV2(tree);
    legacyCards = mapped.legacyCards;
    diagnostics.push(...mapped.issues);
    if (mapped.deck) {
      if (loadDeck) {
        try {
          const loaded = loadDeck({ tree, mapped: mapped.deck });
          if (loaded.issues) diagnostics.push(...loaded.issues);
          deck = loaded.deck;
        } catch (error) {
          diagnostics.push({
            check: 'deck',
            code: 'deck-loader',
            severity: 'error',
            path: '$',
            message: error instanceof Error ? error.message : 'The deck loader failed.',
          });
          deck = null;
        }
      } else {
        deck = mapped.deck;
      }
    }
  }

  const hasDeckError = diagnostics.some((d) => d.severity === 'error' && d.check === 'deck');
  const ok = draft.ok && deck !== null && !hasDeckError;
  return {
    ok,
    status: draft.ok ? (ok ? 'valid' : 'invalid') : draft.status,
    draft,
    deck: ok ? deck : null,
    diagnostics,
    legacyCards,
  };
}
