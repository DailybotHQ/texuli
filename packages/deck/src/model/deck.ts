/**
 * The deck model v2 schemas (ADR-009, model-v2 §3.1, §3.2): `meta`, `style`,
 * `navigation`, `outline` and 1 to 200 slides discriminated by `layout` (the
 * 20 catalog layouts, `free`, `component` and `custom`), with
 * `formatVersion: 2`. Built on the owned schema kit, so one definition gives
 * all-issues validation, the `Infer` types and the JSON Schema export.
 *
 * The engine is L0: blocks and component props are checked here only as
 * bounded JSON with a block head (`type`, `id`, step fields) and known
 * nested containers. `parseDeck` hands each block and component to the
 * host's validators (the slides stage injects `@texuli/blocks` and the
 * component registry).
 */
import {
  type Infer,
  type JsonSchema,
  type JsonValue,
  type PathSegment,
  type RefineContext,
  type Schema,
  t,
  toJsonSchema,
  validate,
} from '../schema/index.ts';
import { deckBackground } from './backgrounds/schema.ts';
import {
  DECK_CATALOG_LAYOUT_IDS,
  DECK_LAYOUTS,
  type DeckCatalogLayoutId,
  type LayoutProps,
  layoutPropsSchema,
} from './layouts/catalog.ts';
import {
  componentProps,
  deckTransition,
  FRAGMENT_TONES,
  line,
  MAX_SLIDE_STEPS,
  multiline,
  SLIDE_ID_PATTERN,
  slideId,
  stepFields,
} from './shared.ts';
import { type DeckDesignSystem, deckDesignSystem } from './style/design-system.ts';
import { deckStyle } from './style/schema.ts';
import { deckThemeReference, styleSlug } from './style/theme.ts';

/** The model's format version. */
export const DECK_FORMAT_VERSION = 2;

/** Deck-level limits (model-v2 §3.2). */
export const DECK_MODEL_LIMITS = Object.freeze({
  slides: 200,
  sections: 200,
  sectionSlides: 200,
  titleLength: 200,
  descriptionLength: 500,
  authorLength: 120,
  outlineTitleLength: 120,
  notesLength: 6_000,
  stepLabels: MAX_SLIDE_STEPS,
  stepLabelLength: 80,
  freeBlocks: 2_000,
  autoSlideMinMs: 1_000,
  autoSlideMaxMs: 600_000,
});

/** v1's eight free-slide arrangements (`master` on a free slide; default `content`). */
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

/** The slide kinds that are not catalog layouts. */
export const DECK_SLIDE_KINDS = ['free', 'component', 'custom'] as const;
export type DeckSlideKind = (typeof DECK_SLIDE_KINDS)[number];

/** Every `layout` value a slide may carry: 20 catalog layouts and the 3 slide kinds. */
export const DECK_SLIDE_LAYOUTS = Object.freeze([
  ...DECK_CATALOG_LAYOUT_IDS,
  ...DECK_SLIDE_KINDS,
] as const);
export type DeckSlideLayout = (typeof DECK_SLIDE_LAYOUTS)[number];

export const DECK_DIRECTIONS = ['ltr', 'rtl', 'auto'] as const;
export type DeckDirection = (typeof DECK_DIRECTIONS)[number];

/** BCP 47 language tag syntax (`en`, `en-GB`, `pt-BR`). */
export const LOCALE_PATTERN = '^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$';
/** An ISO 8601 calendar date. */
export const ISO_DATE_PATTERN = '^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])$';
/** Block `type` and catalog component ids: a lowercase slug starting with a letter. */
export const BLOCK_TYPE_PATTERN = '^[a-z][a-z0-9-]{0,63}$';
export const COMPONENT_ID_PATTERN = BLOCK_TYPE_PATTERN;

/** Block tones (`@texuli/blocks` `BLOCK_TONES`): the fragment tones plus `neutral`. */
export const BLOCK_TONES = ['neutral', ...FRAGMENT_TONES] as const;

/** Component item heights. */
export const COMPONENT_HEIGHTS = ['sm', 'md', 'lg', 'fill'] as const;

/** Bounds for one free-slide item (the outer guard; the host block parser is tighter). */
export const BLOCK_JSON_LIMITS = Object.freeze({
  depth: 12,
  maxKeys: 100,
  maxItems: 2_000,
  /** Room for a 192 KB base64 `data:` image; code and markdown are far smaller. */
  maxString: 300_000,
  maxKeyLength: 64,
});

/**
 * Where nested blocks live inside a block, as the steps pass walks them:
 * `blocks` and `children` (lists of blocks), `columns` (a list of lists) and
 * `panels` (objects with `blocks`).
 */
export const BLOCK_CONTAINERS = Object.freeze({
  lists: ['blocks', 'children'] as const,
  columns: 'columns',
  panels: 'panels',
});

/** The step fields every slide item may carry (removed before the host block parser). */
export const STEP_FIELD_KEYS = ['step', 'fragment', 'reveal'] as const;

// ---------------------------------------------------------------------------
// Meta, navigation, outline

export const deckMeta = t.object(
  {
    title: line(DECK_MODEL_LIMITS.titleLength, 1),
    description: t.optional(line(DECK_MODEL_LIMITS.descriptionLength)),
    locale: t.optional(t.string({ pattern: LOCALE_PATTERN, max: 35 })),
    dir: t.optional(t.enum(DECK_DIRECTIONS), { description: "Default 'auto'." }),
    author: t.optional(line(DECK_MODEL_LIMITS.authorLength)),
    date: t.optional(t.string({ pattern: ISO_DATE_PATTERN, max: 10 })),
  },
  { description: 'Deck metadata: title, description, language, direction, author and date.' }
);
export type DeckMeta = Infer<typeof deckMeta>;

const autoSlideMs = t.refine(t.int({ min: 0, max: DECK_MODEL_LIMITS.autoSlideMaxMs }), {
  code: 'out-of-range',
  description: '0 turns auto-slide off; otherwise 1000 to 600000 ms.',
  check(value, context) {
    if (value !== 0 && value < DECK_MODEL_LIMITS.autoSlideMinMs) {
      context.issue({
        message: `Use 0 (off) or at least ${DECK_MODEL_LIMITS.autoSlideMinMs} ms.`,
        fix: `Set 0, or a value from ${DECK_MODEL_LIMITS.autoSlideMinMs} to ${DECK_MODEL_LIMITS.autoSlideMaxMs}.`,
      });
    }
  },
});

export const deckNavigation = t.object(
  {
    start: t.optional(slideId, {
      description: 'The first slide shown (a visible slide id).',
    }),
    loop: t.optional(t.boolean(), { description: 'Default false.' }),
    autoSlideMs: t.optional(autoSlideMs, { description: 'Default 0 (off).' }),
  },
  { description: 'Navigation: start slide, looping and auto-slide.' }
);
export type DeckNavigation = Infer<typeof deckNavigation>;

export const deckSection = t.object({
  id: slideId,
  title: t.optional(line(DECK_MODEL_LIMITS.outlineTitleLength)),
  slideIds: t.array(slideId, { min: 1, max: DECK_MODEL_LIMITS.sectionSlides }),
  stack: t.optional(t.boolean(), {
    description: 'A vertical stack: the slides are adjacent in `slides` and navigate in 2D.',
  }),
});
export type DeckSection = Infer<typeof deckSection>;

export const deckOutline = t.object(
  {
    title: t.optional(line(DECK_MODEL_LIMITS.outlineTitleLength)),
    sections: t.array(deckSection, { min: 1, max: DECK_MODEL_LIMITS.sections }),
  },
  {
    description:
      'Sections of slide ids: every id is a known slide, and a slide is in at most one section.',
  }
);
export type DeckOutline = Infer<typeof deckOutline>;

// ---------------------------------------------------------------------------
// Slide items: blocks and component items

export type JsonObject = { [key: string]: JsonValue };

const blockHead = t.object(
  {
    type: t.string({ pattern: BLOCK_TYPE_PATTERN, max: 64 }),
    id: t.optional(slideId),
    step: stepFields.step,
    fragment: stepFields.fragment,
    reveal: stepFields.reveal,
    tone: t.optional(t.enum(BLOCK_TONES)),
  },
  { strict: false }
);

const objectProps = (description: string) =>
  t.refine(componentProps, {
    code: 'invalid-type',
    description,
    check(value, context) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        context.issue({ message: 'Expected an object.', fix: 'Pass the props as a JSON object.' });
      }
    },
  });

/** A catalog component placed inline on a free slide. */
export const componentItem = t.object({
  type: t.literal('component'),
  id: t.optional(slideId),
  component: t.string({ pattern: COMPONENT_ID_PATTERN, max: 64 }),
  props: objectProps('Component props (bounded JSON), validated by the host registry.'),
  height: t.optional(t.enum(COMPONENT_HEIGHTS)),
  ...stepFields,
});
export type SlideComponentItem = Infer<typeof componentItem>;

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Check one item's head, then its nested blocks, reporting through the refine context. */
function checkItem(value: unknown, path: PathSegment[], context: RefineContext, depth: number) {
  if (!isBag(value)) {
    context.issue({
      code: 'invalid-block',
      path,
      message: 'A slide item is a block object with a `type`.',
      fix: 'Use {"type": "text", "markdown": "…"} or {"type": "component", "component": "…", "props": {}}.',
    });
    return;
  }
  const isComponent = value.type === 'component';
  const head: Bag = {};
  if (isComponent) Object.assign(head, value);
  else {
    for (const key of ['type', 'id', 'step', 'fragment', 'reveal', 'tone']) {
      if (Object.hasOwn(value, key)) head[key] = value[key];
    }
  }
  const result = validate(isComponent ? componentItem : blockHead, head, { maxIssues: 50 });
  for (const issue of result.issues) {
    context.issue({
      code: issue.code,
      path: [...path, ...issue.path],
      message: issue.message,
      ...(issue.fix === undefined ? {} : { fix: issue.fix }),
      severity: issue.severity,
    });
  }
  if (isComponent || depth >= BLOCK_JSON_LIMITS.depth) return;
  forEachNested(value, path, (child, childPath) => {
    checkItem(child, childPath, context, depth + 1);
  });
}

/** Visit the nested blocks of a block (see `BLOCK_CONTAINERS`). */
export function forEachNested(
  block: Bag,
  path: readonly PathSegment[],
  visit: (child: unknown, path: PathSegment[]) => void
): void {
  for (const key of BLOCK_CONTAINERS.lists) {
    const list = block[key];
    if (Array.isArray(list)) {
      list.forEach((child, i) => {
        visit(child, [...path, key, i]);
      });
    }
  }
  const columns = block[BLOCK_CONTAINERS.columns];
  if (Array.isArray(columns)) {
    columns.forEach((column, c) => {
      if (Array.isArray(column)) {
        column.forEach((child, i) => {
          visit(child, [...path, BLOCK_CONTAINERS.columns, c, i]);
        });
      }
    });
  }
  const panels = block[BLOCK_CONTAINERS.panels];
  if (Array.isArray(panels)) {
    panels.forEach((panel, p) => {
      if (isBag(panel) && Array.isArray(panel.blocks)) {
        panel.blocks.forEach((child, i) => {
          visit(child, [...path, BLOCK_CONTAINERS.panels, p, 'blocks', i]);
        });
      }
    });
  }
}

/**
 * One free-slide item: a block (any `@texuli/blocks` block, checked here as
 * bounded JSON with a block head) or a component item. Nested blocks in the
 * known containers get the same head check.
 */
export const slideItem = t.refine(t.json({ ...BLOCK_JSON_LIMITS, text: 'multiline' }), {
  code: 'invalid-block',
  description:
    'A block object: `type` (lowercase slug), optional `id` (slide id rules), step fields (`step` 0..1000, `fragment` or `reveal`, `tone`), nested blocks in `blocks`, `children`, `columns` and `panels[].blocks`; or a component item {type: "component", component, props, height?}. The host validates block bodies and component props.',
  check(value, context) {
    checkItem(value, [], context, 0);
  },
}) as unknown as Schema<SlideItem>;

/** A block on a free slide: a bounded JSON object with a `type`; its body is the host's. */
export type SlideBlock = JsonObject & {
  type: string;
  id?: string;
  step?: number;
  fragment?: Infer<typeof stepFields.fragment>;
  reveal?: Infer<typeof stepFields.reveal>;
  tone?: (typeof BLOCK_TONES)[number];
};
export type SlideItem = SlideBlock | SlideComponentItem;

// ---------------------------------------------------------------------------
// Slides

const slideBaseShape = {
  id: slideId,
  title: t.optional(line(DECK_MODEL_LIMITS.titleLength)),
  notes: t.optional(multiline(DECK_MODEL_LIMITS.notesLength), {
    description: 'Speaker notes (multi-line, at most 6000 code points).',
  }),
  hidden: t.optional(t.boolean(), {
    description: 'Hidden slides stay out of navigation and print unless the host asks.',
  }),
  background: t.optional(deckBackground),
  transition: t.optional(deckTransition),
  theme: t.optional(deckThemeReference),
  steps: t.optional(
    t.array(line(DECK_MODEL_LIMITS.stepLabelLength), { max: DECK_MODEL_LIMITS.stepLabels }),
    { description: 'Step labels: `steps[i]` names step i + 1.' }
  ),
} as const;

const slideBase = t.object(slideBaseShape);
/** The fields every slide kind shares. */
export type SlideBase = Infer<typeof slideBase>;

function layoutSlide(id: DeckCatalogLayoutId) {
  return t.object(
    {
      ...slideBaseShape,
      layout: t.literal(id),
      props: t.lazy((): Schema => layoutPropsSchema(id), {
        name: id,
        description: `Props of the ${DECK_LAYOUTS[id].label.toLowerCase()} layout.`,
      }),
    },
    { description: DECK_LAYOUTS[id].description }
  );
}

export const freeSlide = t.object(
  {
    ...slideBaseShape,
    layout: t.literal('free'),
    master: t.optional(t.enum(SLIDE_MASTERS), { description: "Default 'content'." }),
    blocks: t.array(slideItem, { max: DECK_MODEL_LIMITS.freeBlocks }),
  },
  { description: 'A free slide: blocks and component items, arranged by a master.' }
);
export type FreeSlide = Omit<Infer<typeof freeSlide>, 'blocks'> & { blocks: SlideItem[] };

export const componentSlide = t.object(
  {
    ...slideBaseShape,
    layout: t.literal('component'),
    component: t.object({
      component: t.string({ pattern: COMPONENT_ID_PATTERN, max: 64 }),
      props: objectProps('Component props (bounded JSON), validated by the host registry.'),
    }),
  },
  { description: 'A whole-slide catalog component.' }
);
export type ComponentSlide = Infer<typeof componentSlide>;

export const customSlide = t.object(
  {
    ...slideBaseShape,
    layout: t.literal('custom'),
    props: t.object({
      component: styleSlug,
      data: t.optional(objectProps('Data for the host component (bounded JSON).')),
    }),
  },
  { description: 'A slide painted by a host-registered component (a placeholder without one).' }
);
export type CustomSlide = Infer<typeof customSlide>;

/** A catalog layout slide: `layout` names the layout, `props` follow its strict schema. */
export type LayoutSlide = {
  [K in DeckCatalogLayoutId]: SlideBase & { layout: K; props: LayoutProps[K] };
}[DeckCatalogLayoutId];

export type DeckSlide = LayoutSlide | FreeSlide | ComponentSlide | CustomSlide;

const SLIDE_OPTIONS = [
  ...DECK_CATALOG_LAYOUT_IDS.map(layoutSlide),
  freeSlide,
  componentSlide,
  customSlide,
] as unknown as readonly [Schema, ...Schema[]];

/** One slide, told apart by `layout` (an unknown one is a single `unknown-layout` issue). */
export const deckSlide = t.union(SLIDE_OPTIONS, {
  discriminator: 'layout',
  code: 'unknown-layout',
  description: 'A slide: a catalog layout with props, a free slide, a component or a custom slide.',
}) as unknown as Schema<DeckSlide>;

// ---------------------------------------------------------------------------
// The deck

const deckShape = {
  formatVersion: t.literal(DECK_FORMAT_VERSION, {
    code: 'unsupported-version',
    description: 'Always 2. Older decks convert with migrateDeck.',
  }),
  meta: deckMeta,
  style: t.optional(deckStyle),
  navigation: t.optional(deckNavigation),
  outline: t.optional(deckOutline),
  slides: t.array(deckSlide, { min: 1, max: DECK_MODEL_LIMITS.slides }),
  designSystem: t.optional(deckDesignSystem),
};

/** The deck document (model v2). Cross-field rules run in `parseDeck`. */
export const deckSchema = t.object(deckShape, {
  description:
    'A Texuli deck (model v2). Cross-field rules checked by parseDeck: unique slide, section and block ids; sections name known slides, each slide in at most one section, stack sections contiguous; navigation.start is a visible slide; not every slide hidden; at most 32 steps per slide; fragment and reveal exclusive.',
}) as unknown as Schema<Deck>;

export interface Deck {
  formatVersion: 2;
  meta: DeckMeta;
  style?: Infer<typeof deckStyle>;
  navigation?: DeckNavigation;
  outline?: DeckOutline;
  slides: DeckSlide[];
  /** The design system the deck follows (`{ ref }` or `{ inline }`, ADR-024). */
  designSystem?: DeckDesignSystem;
}

/** True when `layout` is a slide kind or a catalog layout id. */
export function isSlideLayout(value: unknown): value is DeckSlideLayout {
  return typeof value === 'string' && (DECK_SLIDE_LAYOUTS as readonly string[]).includes(value);
}

/** True when `value` matches the slide id syntax. */
export function isSlideId(value: unknown): value is string {
  return typeof value === 'string' && new RegExp(SLIDE_ID_PATTERN, 'u').test(value);
}

export interface DeckJsonSchemaOptions {
  $id?: string;
}

/**
 * The JSON Schema 2020-12 document of a v2 deck, generated from the same
 * schemas `parseDeck` validates with. Each catalog layout's props is a
 * `$defs` entry named by its id (`#/$defs/title-hero`); cross-field rules are
 * described in `description`.
 */
export function deckJsonSchema(options: DeckJsonSchemaOptions = {}): JsonSchema {
  return toJsonSchema(deckSchema, {
    ...(options.$id === undefined ? {} : { $id: options.$id }),
    title: 'Texuli deck (model v2)',
  });
}
