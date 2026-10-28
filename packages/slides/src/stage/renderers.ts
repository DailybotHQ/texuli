/**
 * The renderer seam (ADR-009, option 3). The stage paints a slide by asking
 * an ordered list of `DeckRenderers` for a component: the first one that
 * answers wins, and the stage's built-in renderers are the last resort.
 *
 * - The **layouts lane** answers `layout` (the 20 catalog layouts) and may
 *   replace `background`.
 * - The **registry lane** answers `component` (whole-slide components),
 *   `item` (component items on free slides), and supplies the parse hooks
 *   (`knownComponents`, `validateComponent`) for the second validation phase.
 * - A **host** answers `custom` (and may override anything with `slide`),
 *   and may replace the free-slide block check with `validateBlock`, or with
 *   `loadValidateBlock` to import that check on first use (the stage resolves
 *   it before it validates, so the validator stays out of the initial JS).
 *
 * The stage appends its default tables (layouts and the component registry)
 * after the host's, imported on first use (`loadDefaultDeckRenderers`);
 * `defaultRenderers={false}` leaves them out, and none of their code loads.
 *
 * A renderer is a Svelte component, or `{ load }` for one that is imported on
 * first use (only mounted slides trigger the import; `prefetch` warms the
 * next ones while the browser is idle). Renderers never receive HTML: they
 * get the validated slide, the host's URL-policy tier and the step context.
 */
import type {
  ComponentSlide,
  CustomSlide,
  Deck,
  DeckSlide,
  FreeSlide,
  LayoutSlide,
  ResolvedDeckBackground,
  SlideComponentItem,
} from '@texuli/deck/model';
import { createDiagnostic, type DeckDiagnostic, type PathSegment } from '@texuli/deck/schema';
import type { Component } from 'svelte';
import type { DeckMediaTrust } from './media.ts';
import type { DeckTranslate } from './messages.ts';
import type { DeckValidationHooks } from './prepare.ts';
import type { DeckStepContext } from './steps.ts';

/** A component imported on first use. `load` may resolve to the component or its module. */
export interface DeckLazyRenderer<Props extends Record<string, unknown>> {
  load(): Promise<Component<Props> | { default: Component<Props> }>;
}

export type DeckRendererEntry<Props extends Record<string, unknown>> =
  | Component<Props>
  | DeckLazyRenderer<Props>;

/** Everything a slide renderer may read besides the slide (also on `getDeckStepContext()`). */
export interface DeckSlideRenderContext {
  readonly deck: Deck;
  /** Index into `deck.slides`. */
  readonly index: number;
  /** The active slide; the previous and next slides are mounted inert and hidden. */
  readonly active: boolean;
  /** The URL-policy tier for every link and media source this slide paints. */
  readonly tier: DeckMediaTrust;
  readonly t: DeckTranslate;
  readonly step: DeckStepContext;
  /** The fixed virtual canvas (1280 × 720 for 16:9): renderers lay out in these pixels. */
  readonly canvas: { readonly width: number; readonly height: number };
  readonly resolveAvatar?: (id: string) => string | undefined;
  /** The renderer list, so a free-slide renderer can resolve its component items. */
  readonly renderers: readonly DeckRenderers[];
}

/** Props of a slide renderer; kind resolvers narrow `S` (`LayoutSlide`, `FreeSlide`, …). */
export interface DeckSlideRendererProps<S extends DeckSlide = DeckSlide>
  extends Record<string, unknown> {
  slide: S;
  context: DeckSlideRenderContext;
}

export interface DeckItemRendererProps extends Record<string, unknown> {
  item: SlideComponentItem;
  /** Slide-relative path of the item (`['blocks', 3]`), for `context.step.attributes(path)`. */
  path: readonly (string | number)[];
  context: DeckSlideRenderContext;
}

export interface DeckBackgroundRendererProps extends Record<string, unknown> {
  background: ResolvedDeckBackground;
  tier: DeckMediaTrust;
  slide: DeckSlide;
}

/** What a resolver can see while choosing (never the DOM). */
export interface DeckRendererLookup {
  readonly tier: DeckMediaTrust;
}

type Resolve<S, P extends Record<string, unknown>> = (
  value: S,
  lookup: DeckRendererLookup
) => DeckRendererEntry<P> | null | undefined;

/** A free-slide block check (`validateBlock`): the diagnostics of one block, if any. */
export type DeckBlockValidator = NonNullable<DeckValidationHooks['validateBlock']>;

/** What `loadValidateBlock` may resolve to: the check, or a module exporting it. */
export type DeckBlockValidatorModule =
  | DeckBlockValidator
  | { readonly validateBlock: DeckBlockValidator }
  | { readonly default: DeckBlockValidator };

export interface DeckRenderers extends DeckValidationHooks {
  /**
   * `validateBlock`, imported on first use (`() => import('./validate-block.ts')`).
   * The stage resolves it before it validates a deck and paints nothing
   * meanwhile; a `validateBlock` on the same table wins over it. If the
   * import fails, every free-slide block is refused (the deck shows its
   * error state, never unchecked content).
   */
  loadValidateBlock?(): Promise<DeckBlockValidatorModule>;
  /** Any slide; answered first (a host override). */
  slide?: Resolve<DeckSlide, DeckSlideRendererProps>;
  /** Catalog layout slides (the layouts lane). */
  layout?: Resolve<LayoutSlide, DeckSlideRendererProps<LayoutSlide>>;
  /** Free slides; the stage's built-in block renderer answers otherwise. */
  free?: Resolve<FreeSlide, DeckSlideRendererProps<FreeSlide>>;
  /** Whole-slide catalog components (the registry lane). */
  component?: Resolve<ComponentSlide, DeckSlideRendererProps<ComponentSlide>>;
  /** Host-registered custom slides. */
  custom?: Resolve<CustomSlide, DeckSlideRendererProps<CustomSlide>>;
  /** Component items placed on a free slide (the registry lane). */
  item?: Resolve<SlideComponentItem, DeckItemRendererProps>;
  /** Slide backgrounds (the backgrounds lane); the stage paints the layers itself otherwise. */
  background?: Resolve<ResolvedDeckBackground, DeckBackgroundRendererProps>;
  /** Warm whatever `slide` will need (lazy chunks); called while the browser is idle. */
  prefetch?(slide: DeckSlide): Promise<unknown> | undefined;
}

export function isLazyRenderer<P extends Record<string, unknown>>(
  entry: DeckRendererEntry<P>
): entry is DeckLazyRenderer<P> {
  return typeof entry === 'object' && entry !== null && typeof entry.load === 'function';
}

/** Flatten the `renderers` prop (one table or a list, first wins). */
export function deckRendererList(
  renderers: DeckRenderers | readonly DeckRenderers[] | null | undefined
): readonly DeckRenderers[] {
  if (!renderers) return [];
  return Array.isArray(renderers) ? renderers : [renderers as DeckRenderers];
}

function first<S, P extends Record<string, unknown>>(
  list: readonly DeckRenderers[],
  pick: (renderers: DeckRenderers) => Resolve<S, P> | undefined,
  value: S,
  lookup: DeckRendererLookup
): DeckRendererEntry<P> | undefined {
  for (const renderers of list) {
    const resolve = pick(renderers);
    if (!resolve) continue;
    try {
      const entry = resolve(value, lookup);
      if (entry) return entry;
    } catch {
      // A failing resolver falls through to the next one.
    }
  }
  return undefined;
}

/**
 * The host renderer for a slide (`slide`, then the kind's resolver), or
 * `undefined` when the stage should use its built-in renderer.
 */
export function resolveSlideRenderer(
  list: readonly DeckRenderers[],
  slide: DeckSlide,
  lookup: DeckRendererLookup
): DeckRendererEntry<DeckSlideRendererProps> | undefined {
  const any = first(list, (r) => r.slide, slide, lookup);
  if (any) return any;
  // Each kind resolver only ever sees its own kind, so the narrowed entry is safe to widen.
  type Entry = DeckRendererEntry<DeckSlideRendererProps> | undefined;
  switch (slide.layout) {
    case 'free':
      return first(list, (r) => r.free, slide, lookup) as Entry;
    case 'component':
      return first(list, (r) => r.component, slide, lookup) as Entry;
    case 'custom':
      return first(list, (r) => r.custom, slide, lookup) as Entry;
    default:
      return first(list, (r) => r.layout, slide, lookup) as Entry;
  }
}

export function resolveItemRenderer(
  list: readonly DeckRenderers[],
  item: SlideComponentItem,
  lookup: DeckRendererLookup
): DeckRendererEntry<DeckItemRendererProps> | undefined {
  return first(list, (r) => r.item, item, lookup);
}

export function resolveBackgroundRenderer(
  list: readonly DeckRenderers[],
  background: ResolvedDeckBackground,
  lookup: DeckRendererLookup
): DeckRendererEntry<DeckBackgroundRendererProps> | undefined {
  return first(list, (r) => r.background, background, lookup);
}

// Lazy block validators by table: the loaded check, or the refusal when its import failed.
const BLOCK_VALIDATORS = new WeakMap<object, DeckBlockValidator>();
const BLOCK_VALIDATOR_LOADS = new WeakMap<object, Promise<void>>();

function blockValidatorOf(loaded: DeckBlockValidatorModule): DeckBlockValidator | undefined {
  if (typeof loaded === 'function') return loaded;
  if (loaded && typeof loaded === 'object') {
    if ('validateBlock' in loaded && typeof loaded.validateBlock === 'function') {
      return loaded.validateBlock;
    }
    if ('default' in loaded && typeof loaded.default === 'function') return loaded.default;
  }
  return undefined;
}

function refuseBlocks(_block: unknown, path: PathSegment[]): DeckDiagnostic[] {
  return [
    createDiagnostic('block-props', 'The block check could not be loaded.', path, {
      fix: "Check the host's loadValidateBlock import.",
    }),
  ];
}

function lazyBlockTable(table: DeckRenderers): boolean {
  return typeof table.validateBlock !== 'function' && typeof table.loadValidateBlock === 'function';
}

/** True when every `loadValidateBlock` in the list has settled (so validation can run). */
export function deckValidatorsReady(list: readonly DeckRenderers[]): boolean {
  return list.every((table) => !lazyBlockTable(table) || BLOCK_VALIDATORS.has(table));
}

/**
 * Import every `loadValidateBlock` of the list once (later calls share the
 * import). Never rejects: a failed import or a module without a check
 * leaves a validator that refuses every block.
 */
export function loadDeckValidators(list: readonly DeckRenderers[]): Promise<void> {
  const loads = list.filter(lazyBlockTable).map((table) => {
    const started = BLOCK_VALIDATOR_LOADS.get(table);
    if (started) return started;
    const load = Promise.resolve()
      .then(() => table.loadValidateBlock?.())
      .then(
        (loaded) => {
          const check = loaded === undefined ? undefined : blockValidatorOf(loaded);
          BLOCK_VALIDATORS.set(table, check ? check.bind(table) : refuseBlocks);
        },
        () => {
          BLOCK_VALIDATORS.set(table, refuseBlocks);
        }
      );
    BLOCK_VALIDATOR_LOADS.set(table, load);
    return load;
  });
  return Promise.all(loads).then(() => undefined);
}

/**
 * Merge the parse hooks of every renderer table: component ids are unioned,
 * component validators all run, and the first table with a `validateBlock`
 * or a `loadValidateBlock` (the host's, ahead of the defaults) replaces the
 * stage's block check. A lazy check that has not loaded yet refuses every
 * block (call `loadDeckValidators` first), so nothing unchecked is accepted.
 */
export function deckValidationHooks(list: readonly DeckRenderers[]): DeckValidationHooks {
  const known = list.flatMap((r) => r.knownComponents ?? []);
  const validators = list.flatMap((r) => (r.validateComponent ? [r.validateComponent] : []));
  const declared = list.some((r) => r.knownComponents !== undefined);
  const blockTable = list.find(
    (r) => typeof r.validateBlock === 'function' || typeof r.loadValidateBlock === 'function'
  );
  const validateBlock = blockTable?.validateBlock
    ? blockTable.validateBlock.bind(blockTable)
    : blockTable
      ? (BLOCK_VALIDATORS.get(blockTable) ?? refuseBlocks)
      : undefined;
  return {
    ...(declared ? { knownComponents: [...new Set(known)] } : {}),
    ...(validateBlock ? { validateBlock } : {}),
    ...(validators.length > 0
      ? {
          validateComponent: (component, path) => {
            const issues = validators.flatMap((validate) => [...(validate(component, path) ?? [])]);
            return issues.length > 0 ? issues : undefined;
          },
        }
      : {}),
  };
}

const LOADED = new WeakMap<object, Component<never>>();

/** The component of an entry that is ready now (a direct component or an already-loaded lazy one). */
export function readyRenderer<P extends Record<string, unknown>>(
  entry: DeckRendererEntry<P>
): Component<P> | undefined {
  if (!isLazyRenderer(entry)) return entry;
  return LOADED.get(entry) as Component<P> | undefined;
}

/** Load a lazy entry once; direct components resolve at once. */
export async function loadRenderer<P extends Record<string, unknown>>(
  entry: DeckRendererEntry<P>
): Promise<Component<P>> {
  if (!isLazyRenderer(entry)) return entry;
  const cached = LOADED.get(entry);
  if (cached) return cached as Component<P>;
  const loaded = await entry.load();
  const component =
    typeof loaded === 'function' ? loaded : (loaded as { default: Component<P> }).default;
  LOADED.set(entry, component as Component<never>);
  return component;
}
