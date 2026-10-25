import type { PlayerLoader } from '@texuli/catalog/player';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';

/**
 * Catalog ids that are host chrome, never blueprint content (player design
 * §8: "the composer is always host chrome"). The player refuses them at every
 * tier, even when a host catalog lists them, and never loads their painter.
 */
export const HOST_CHROME_IDS: readonly string[] = Object.freeze(['chat-composer']);

export function isHostChromeId(id: string): boolean {
  return HOST_CHROME_IDS.includes(id);
}

/** Wrap a catalog so host-chrome ids are not allowed for any tier. */
export function withoutHostChrome(catalog: RenderCatalog): RenderCatalog {
  return {
    get: (id) => catalog.get(id),
    allows: (id, tier) => {
      if (isHostChromeId(id)) return false;
      if (catalog.allows) return catalog.allows(id, tier);
      // The renderer's default: untrusted needs an emit entry or agentEmittable.
      const spec = catalog.get(id);
      if (!spec) return false;
      if (tier !== 'untrusted') return true;
      return spec.emit ? spec.emit.includes('untrusted') : spec.agentEmittable === true;
    },
  };
}

/** Drop host-chrome painters from a loader map. */
export function withoutHostChromeLoaders(
  loaders: Readonly<Record<string, PlayerLoader>>
): Readonly<Record<string, PlayerLoader>> {
  if (!Object.keys(loaders).some(isHostChromeId)) return loaders;
  return Object.freeze(
    Object.fromEntries(Object.entries(loaders).filter(([id]) => !isHostChromeId(id)))
  );
}
