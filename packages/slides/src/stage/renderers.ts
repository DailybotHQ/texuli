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
 *   and may replace the free-slide block check with `validateBlock`.
 *
 * The stage appends its default tables (layouts and the component registry)
 * after the host's; `defaultRenderers={false}` leaves them out.
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

export interface DeckRenderers extends DeckValidationHooks {
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

/**
 * Merge the parse hooks of every renderer table: component ids are unioned,
 * component validators all run, and the first table with a `validateBlock`
 * (the host's, ahead of the defaults) replaces the stage's block check.
 */
export function deckValidationHooks(list: readonly DeckRenderers[]): DeckValidationHooks {
  const known = list.flatMap((r) => r.knownComponents ?? []);
  const validators = list.flatMap((r) => (r.validateComponent ? [r.validateComponent] : []));
  const declared = list.some((r) => r.knownComponents !== undefined);
  const blockTable = list.find((r) => typeof r.validateBlock === 'function');
  return {
    ...(declared ? { knownComponents: [...new Set(known)] } : {}),
    ...(blockTable?.validateBlock
      ? { validateBlock: blockTable.validateBlock.bind(blockTable) }
      : {}),
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
