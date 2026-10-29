/**
 * The default component registry (ADR-009, component-on-slide contract): a
 * `DeckRenderers` table that paints any slide-renderable catalog component
 * (every `@texuli/blocks` family and every component the player paints) on
 * whole-slide `component` slides and as `::: component` items on free
 * slides, and extends free slides with `$$` math blocks, images measured at
 * paint, and the diagram, map and embed block families.
 *
 * - **Lazy:** the table holds only data and `{ load }` entries; the player
 *   and each painter family load when a slide that needs them mounts (or is
 *   prefetched), so a deck with only text pulls no chart or data code.
 * - **Tier:** the stage's tier (`untrusted` by default) reaches the player,
 *   which validates the node again before painting; the parse hook checks
 *   props at the registry's own tier.
 * - **State:** a `SlideStateHost` (memory by default) keeps each component's
 *   local state between mounts, keyed by slide id and item path.
 * - **Capabilities:** mutations are off unless the host grants them
 *   (`reorder` is on: local only), and actions are the host's `onAction`.
 * - **Extensible:** `overrides` replaces or adds a painter per catalog id;
 *   `exclude` removes ids.
 */
import { createDiagnostic, type DeckDiagnostic } from '@texuli/deck/schema';
import type { ActionHandler } from '@texuli/player';
import type { Component } from 'svelte';
import type { DeckRenderers, DeckSlideRendererProps } from '../stage/renderers.ts';
import type { SlideCapabilities } from './blueprint.ts';
import {
  SLIDE_COMPONENT_EXCLUSIONS,
  SLIDE_COMPONENTS,
  SLIDE_EXCLUDED_GROUPS,
  slideComponentSupport,
} from './catalog-ids.ts';
import { REGISTRY_RENDERER_ENTRIES } from './entries.ts';
import { extendedItem } from './extended.ts';
import { createMemoryStateHost, type SlideStateHost } from './state.ts';

export {
  componentBlueprint,
  componentState,
  DECLARE_KEY,
  gatedProps,
  hasCapability,
  type SlideCapabilities,
  stateReads,
} from './blueprint.ts';
export {
  BLOCK_FAMILY_IDS,
  SLIDE_COMPONENT_EXCLUSIONS,
  SLIDE_COMPONENTS,
  SLIDE_EXCLUDED_GROUPS,
  type SlideCapability,
  type SlideComponentFamily,
  type SlideComponentInfo,
  type SlideComponentSupport,
  slideComponentSupport,
} from './catalog-ids.ts';
export {
  type ExtendedItem,
  extendedItem,
  isUnsizedImage,
  playerFamilyOf,
  withStandInSize,
} from './extended.ts';
export {
  createMemoryStateHost,
  type SlideStateHost,
  type SlideStateSnapshot,
  slideStateKey,
} from './state.ts';
export {
  checkSlideFamilyBlock,
  type SlideComponentCheck,
  slideCatalog,
  validateSlideBlock,
  validateSlideComponent,
} from './validate.ts';

/** What a host painter for one catalog id receives. */
export interface SlideComponentPainterProps extends Record<string, unknown> {
  id: string;
  props: Readonly<Record<string, unknown>>;
  context: DeckSlideRendererProps['context'];
  /** The state key of this component (`<slide id>/<path>`). */
  stateKey: string;
}

export interface ComponentRegistryOptions {
  /** Where interactive state lives between mounts. Default: a new memory host. */
  stateHost?: SlideStateHost;
  /** Mutations the host allows (default: local reorder only). */
  capabilities?: SlideCapabilities;
  /** The host's answer to form actions; without it, forms cannot submit. */
  onAction?: ActionHandler;
  /** Replace the painter of a catalog id, or add a host component id. */
  overrides?: Readonly<Record<string, Component<SlideComponentPainterProps>>>;
  /** Catalog ids this host does not allow on slides. */
  exclude?: readonly string[];
  /**
   * A parse-time props check, run by `parseDeck` for every component. The
   * default checks ids and exclusions only: the player validates the props
   * with the catalog at the stage's tier before it paints (the second
   * phase), so nothing invalid is ever painted. Pass `validateSlideComponent`
   * to refuse invalid props at parse time too (it loads the catalog and the
   * block engines eagerly: about 35 KiB gzip more).
   */
  validateProps?: (
    component: { component: string; props: Record<string, unknown> },
    path: readonly (string | number)[],
    options: { tier: 'untrusted' | 'developer'; capabilities: SlideCapabilities }
  ) => readonly DeckDiagnostic[];
  /** The tier `validateProps` checks at. Default `untrusted`. */
  validationTier?: 'untrusted' | 'developer';
}

/** The options as the painters read them (resolved defaults). */
export interface ResolvedRegistryOptions {
  stateHost: SlideStateHost;
  capabilities: SlideCapabilities;
  onAction: ActionHandler | undefined;
  overrides: Readonly<Record<string, Component<SlideComponentPainterProps>>>;
  exclude: ReadonlySet<string>;
}

/** Marks a renderer table built by this registry (the painters find their options through it). */
export const REGISTRY_OPTIONS: unique symbol = Symbol.for('@texuli/slides/registry/options');

export type ComponentRenderers = DeckRenderers & {
  readonly [REGISTRY_OPTIONS]: ResolvedRegistryOptions;
};

/** The registry options from a stage's renderer list (defaults when none is there). */
export function registryOptions(renderers: readonly DeckRenderers[]): ResolvedRegistryOptions {
  for (const table of renderers) {
    const options = (table as Partial<ComponentRenderers>)[REGISTRY_OPTIONS];
    if (options) return options;
  }
  return DEFAULT_OPTIONS;
}

const DEFAULT_OPTIONS: ResolvedRegistryOptions = Object.freeze({
  stateHost: createMemoryStateHost(),
  capabilities: Object.freeze({}),
  onAction: undefined,
  overrides: Object.freeze({}),
  exclude: new Set<string>(),
});

/** Every catalog id the registry knows: paintable, excluded with a reason (for its message). */
function knownIds(options: ResolvedRegistryOptions): string[] {
  const ids = [
    ...Object.keys(SLIDE_COMPONENTS),
    ...Object.keys(SLIDE_COMPONENT_EXCLUSIONS),
    ...Object.values(SLIDE_EXCLUDED_GROUPS).flatMap((group) => group.ids),
    ...Object.keys(options.overrides),
  ];
  return [...new Set(ids)];
}

/** True when this registry paints `id` (a slide component or a host override, not excluded). */
export function paintsComponent(id: string, options: ResolvedRegistryOptions): boolean {
  if (options.exclude.has(id)) return false;
  if (Object.hasOwn(options.overrides, id)) return true;
  return slideComponentSupport(id).kind === 'component';
}

/** Build a registry table; `componentRenderers` is the default one. */
export function createComponentRenderers(
  options: ComponentRegistryOptions = {}
): ComponentRenderers {
  const resolved: ResolvedRegistryOptions = Object.freeze({
    stateHost: options.stateHost ?? createMemoryStateHost(),
    capabilities: Object.freeze({ ...(options.capabilities ?? {}) }),
    onAction: options.onAction,
    overrides: Object.freeze({ ...(options.overrides ?? {}) }),
    exclude: new Set(options.exclude ?? []),
  });
  const { slide: slideEntry, item: itemEntry, free: freeEntry } = REGISTRY_RENDERER_ENTRIES;
  const tier = options.validationTier ?? 'untrusted';

  return {
    [REGISTRY_OPTIONS]: resolved,
    component: (slide) =>
      paintsComponent(slide.component.component, resolved) ? slideEntry : null,
    item: (item) => (paintsComponent(item.component, resolved) ? itemEntry : null),
    free: (slide) =>
      slide.blocks.some((item) => extendedItem(item) !== undefined) ? freeEntry : null,
    knownComponents: knownIds(resolved).filter((id) => !resolved.exclude.has(id)),
    validateComponent: (component, path) => {
      if (resolved.exclude.has(component.component)) return undefined;
      // A host painter validates its own props.
      if (Object.hasOwn(resolved.overrides, component.component)) return undefined;
      const support = slideComponentSupport(component.component);
      if (support.kind === 'excluded') {
        return [
          createDiagnostic(
            'component-excluded',
            `"${component.component}" is not a slide component: ${support.reason}`,
            [...path, 'component'],
            { fix: 'Use a slide-renderable catalog component, a block family or a slide layout.' }
          ),
        ];
      }
      if (!options.validateProps || support.kind !== 'component') return undefined;
      const issues = options.validateProps(component, path, {
        tier,
        capabilities: resolved.capabilities,
      });
      return issues.length > 0 ? [...issues] : undefined;
    },
    prefetch: (slide) => {
      if (slide.layout === 'component') return slideEntry.load();
      if (slide.layout === 'free') {
        const loads: Promise<unknown>[] = [];
        if (slide.blocks.some((item) => item.type === 'component')) loads.push(itemEntry.load());
        if (slide.blocks.some((item) => extendedItem(item) !== undefined))
          loads.push(freeEntry.load());
        return loads.length > 0 ? Promise.all(loads) : undefined;
      }
      return undefined;
    },
  };
}

/** The default registry: memory state, local reorder, no actions, no host overrides. */
export const componentRenderers: ComponentRenderers = createComponentRenderers();
