import type { Catalog, CatalogEntry } from '../../build/build.ts';
import { isTierU } from '../../build/build.ts';
import type { RenderCatalog, RenderComponentSpec } from './types.ts';

export interface RenderCatalogFromBuildOptions {
  /**
   * What the `developer` tier may emit. `emittable` (the default, normative
   * per roadmap decision D5) is the build's developer tier: every
   * `agentEmittable` component. `all` also lets a trusted author place app
   * chrome (dialogs, shells); hosts opt in explicitly.
   */
  developer?: 'emittable' | 'all';
}

/** Build a {@link RenderCatalog} from a built catalog file. */
export function renderCatalogFromBuild(
  catalog: Catalog,
  options: RenderCatalogFromBuildOptions = {}
): RenderCatalog {
  const byId = new Map<string, RenderComponentSpec>();
  for (const entry of catalog.entries) {
    byId.set(entry.id, specFromEntry(entry));
  }
  const developerAll = options.developer === 'all';
  return {
    get(id) {
      return byId.get(id);
    },
    allows(id, tier) {
      if (tier !== 'developer') return isTierU(catalog, id);
      return developerAll ? byId.has(id) : catalog.tiers.developer.includes(id);
    },
  };
}

/** Build a {@link RenderCatalog} from an explicit list of specs (tests). */
export function renderCatalogFromSpecs(specs: readonly RenderComponentSpec[]): RenderCatalog {
  const byId = new Map(specs.map((spec) => [spec.id, spec]));
  return {
    get(id) {
      return byId.get(id);
    },
    allows(id, tier) {
      const spec = byId.get(id);
      if (!spec) return false;
      if (tier !== 'developer') {
        if (spec.emit) return spec.emit.includes('untrusted');
        return spec.agentEmittable === true;
      }
      return true;
    },
  };
}

function specFromEntry(entry: CatalogEntry): RenderComponentSpec {
  return {
    id: entry.id,
    label: entry.label,
    props: entry.props,
    agentEmittable: entry.agentEmittable === true,
    emit: entry.emit,
    ...(entry.events ? { events: entry.events } : {}),
    ...(entry.bindable ? { bindable: entry.bindable } : {}),
    ...(entry.sourceable ? { sourceable: entry.sourceable } : {}),
  };
}
