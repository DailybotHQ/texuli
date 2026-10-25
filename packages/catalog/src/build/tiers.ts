import type { CatalogManifest } from '../manifest/types.ts';

/**
 * Who may emit a component id into a catalog tree.
 * - `developer`: trees authored by developers or trusted agents; every
 *   agent-emittable component.
 * - `untrusted` (Tier U): untrusted model output; only content components
 *   and content layouts, never overlays, focus traps or shells.
 */
export type CatalogEmitTier = 'developer' | 'untrusted';

/** Manifest groups whose components are page chrome: never in Tier U. */
export const CHROME_GROUPS: readonly string[] = ['overlays', 'navigation', 'shells'];

/**
 * The content layouts Tier U may use, in the `layouts` group. `deck-slide`
 * is a deck's slide frame (G11), so an agent deck can be typed slide by slide.
 */
export const CONTENT_LAYOUT_IDS: readonly string[] = [
  'card',
  'page',
  'doc',
  'deck',
  'grid',
  'deck-slide',
];

/**
 * Ids of overlays and focus traps (modal or floating layers, wherever they
 * are authored). These are never agent-emittable.
 */
const OVERLAY_ID =
  /(^|-)(dialog|modal|sheet|drawer|popover|tooltip|hover-card|menu|menubar|toast|command|combobox|overlay|portal|focus-trap)($|-)/;

/** Ids of application shells: never in Tier U. */
const SHELL_ID = /(^|-)(shell|sidebar|navbar|app-bar|titlebar)($|-)/;

/** Whether `id` names an overlay or focus trap. */
export function isOverlayId(id: string): boolean {
  return OVERLAY_ID.test(id);
}

/** Whether `id` names an application shell. */
export function isShellId(id: string): boolean {
  return SHELL_ID.test(id);
}

/** Whether `id` is one of the content layouts (`card`, `layout-card`, `card-layout`…). */
export function isContentLayoutId(id: string): boolean {
  const base = id.replace(/^layout-/, '').replace(/-layout$/, '');
  return CONTENT_LAYOUT_IDS.includes(base);
}

/** The tiers a manifest from `group` belongs to (empty: not emittable). */
export function emitTiers(manifest: CatalogManifest, group: string): CatalogEmitTier[] {
  if (manifest.agentEmittable !== true) return [];
  const chrome =
    CHROME_GROUPS.includes(group) || isOverlayId(manifest.id) || isShellId(manifest.id);
  const content =
    group === 'layouts' ? isContentLayoutId(manifest.id) : manifest.tier === 'content';
  return !chrome && content ? ['developer', 'untrusted'] : ['developer'];
}
