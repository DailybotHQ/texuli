// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { CHROME_GROUPS, isOverlayId, isShellId } from '../src/build/tiers.ts';
import { createPlayer } from '../src/player/index.ts';
import { createArtifactFrame } from '../src/render/frame/index.ts';
import {
  type RenderNode,
  renderCatalogFromBuild,
  renderCatalogTree,
  resolveTier,
} from '../src/render/renderer/index.ts';
import { validateDraft } from '../src/validate/index.ts';

/**
 * Roadmap decision D5, made normative: the `developer` tier is the build's
 * agent-emittable ids, not every catalog id. App chrome needs the host's
 * explicit `developer: 'all'`. Tier U is a subset of the developer tier.
 * The tier is the host's choice, never the blueprint's, and anything but the
 * exact string `'developer'` is `untrusted`.
 */

const build = await buildCatalog(await discoverManifestGroups());
const entries = build.catalog.entries;
const normative = renderCatalogFromBuild(build.catalog);
const chrome = renderCatalogFromBuild(build.catalog, { developer: 'all' });

/**
 * The agent-emittable ids, pinned. Changing this list is a deliberate
 * contract change (it was 36 when D5 was written; G05 added four block
 * families; G11 added deck-slide): update the docs with it.
 */
const EMITTABLE_IDS = [
  'blocks-code',
  'blocks-data',
  'blocks-diagram',
  'blocks-embed',
  'blocks-interactive',
  'blocks-map',
  'blocks-media',
  'blocks-structure',
  'blocks-text',
  'charts-area',
  'charts-bar',
  'charts-bubble',
  'charts-bullet',
  'charts-canvas-renderer',
  'charts-cartesian',
  'charts-combo',
  'charts-donut',
  'charts-funnel',
  'charts-gauge',
  'charts-geo-map',
  'charts-geo-point-map',
  'charts-heatmap',
  'charts-line',
  'charts-network',
  'charts-pie',
  'charts-progress-ring',
  'charts-sankey',
  'charts-scatter',
  'charts-sparkline',
  'charts-stacked-bar',
  'charts-sunburst',
  'charts-treemap',
  'deck-slide',
  'layout-card',
  'layout-deck',
  'layout-doc',
  'layout-grid',
  'layout-page',
  'media-composition-canvas',
  'media-composition-svg',
  'media-image',
];

const emittable = new Set(EMITTABLE_IDS);
const tierU = new Set(build.catalog.tiers.untrusted);

/** Whether rendering `id` alone at `tier` is refused for its tier. */
function tierDenied(catalog: typeof normative, id: string, tier: unknown): boolean {
  const result = renderCatalogTree({ id, props: {} }, { catalog, tier: tier as never });
  const root = result.roots[0] as RenderNode | undefined;
  return root?.kind === 'placeholder' && root.reason === 'tier-denied';
}

describe('the developer tier is the agent-emittable ids (D5)', () => {
  it('pins the agent-emittable ids, and the build tiers follow them', () => {
    const fromManifests = entries.filter((e) => e.agentEmittable === true).map((e) => e.id);
    expect([...fromManifests].sort()).toEqual(EMITTABLE_IDS);
    expect([...build.catalog.tiers.developer].sort()).toEqual(EMITTABLE_IDS);
    expect(entries.length).toBeGreaterThan(EMITTABLE_IDS.length);
  });

  it('keeps Tier U inside the developer tier, and app chrome out of both', () => {
    for (const id of tierU) expect(emittable.has(id), id).toBe(true);
    for (const entry of entries.filter((e) => emittable.has(e.id))) {
      expect(CHROME_GROUPS.includes(entry.group), entry.id).toBe(false);
      expect(isOverlayId(entry.id) || isShellId(entry.id), entry.id).toBe(false);
    }
  });

  it.each(entries.map((e) => e.id))('%s: allowed exactly as the tier contract says', (id) => {
    expect(normative.allows?.(id, 'developer'), 'developer').toBe(emittable.has(id));
    expect(normative.allows?.(id, 'untrusted'), 'untrusted').toBe(tierU.has(id));
    expect(chrome.allows?.(id, 'developer'), "developer: 'all'").toBe(true);
    expect(chrome.allows?.(id, 'untrusted'), "untrusted with developer: 'all'").toBe(tierU.has(id));
    expect(tierDenied(normative, id, 'developer'), 'renders at developer').toBe(!emittable.has(id));
    expect(tierDenied(normative, id, 'untrusted'), 'renders at untrusted').toBe(!tierU.has(id));
    expect(tierDenied(chrome, id, 'developer'), "renders with developer: 'all'").toBe(false);
  });

  it('refuses unknown ids in every tier and mode', () => {
    for (const catalog of [normative, chrome]) {
      for (const tier of ['developer', 'untrusted'] as const) {
        expect(catalog.allows?.('not-a-component', tier)).toBe(false);
      }
    }
  });
});

describe('the tier is the host choice and fails closed', () => {
  const dialog = { id: 'dialog', props: { title: 'Delete every record?' } };
  const odd = [
    'Untrusted',
    'UNTRUSTED',
    'Developer',
    'DEVELOPER',
    'admin',
    '',
    ' developer',
    null,
    1,
  ];

  it('resolves only the exact string "developer" to the developer tier', () => {
    expect(resolveTier('developer')).toBe('developer');
    expect(resolveTier('untrusted')).toBe('untrusted');
    expect(resolveTier(undefined)).toBe('untrusted');
    for (const value of odd) expect(resolveTier(value), String(value)).toBe('untrusted');
  });

  it.each(odd.map((value) => [JSON.stringify(value), value]))(
    'treats tier %s as untrusted in the renderer, validateDraft, the player and frames',
    (_label, value) => {
      const tier = value as never;
      // Even a host catalog that lets developers place chrome.
      expect(tierDenied(chrome, 'dialog', tier)).toBe(true);
      const validation = validateDraft(dialog, { catalog: chrome, tier, frameRoots: false });
      expect(validation.tier).toBe('untrusted');
      expect(validation.ok).toBe(false);
      const player = createPlayer({ blueprint: dialog, catalog: chrome, tier, frameRoots: false });
      expect(player.receipt().tier).toBe('untrusted');
      expect(player.state.validation.ok).toBe(false);
      const frame = createArtifactFrame({
        label: 'Report',
        catalog: chrome,
        tree: dialog,
        tier,
        allowDeveloperTier: true,
      });
      expect(frame.roots[0]).toMatchObject({ kind: 'placeholder', reason: 'tier-denied' });
    }
  );

  it('ignores a tier the envelope declares', () => {
    const envelope = {
      kind: 'texuli.blueprint',
      version: 1,
      id: 'env-tier-001',
      tier: 'developer',
      tree: { id: 'layout-card', props: { title: 'Summary' } },
    };
    const result = validateDraft(envelope, { catalog: chrome, frameRoots: false });
    expect(result.tier).toBe('untrusted');
  });

  it('keeps the developer tier for a host that asks for it exactly', () => {
    const tree = { id: 'layout-card', props: { title: 'Summary' } };
    expect(validateDraft(tree, { catalog: normative, tier: 'developer' }).tier).toBe('developer');
    expect(tierDenied(chrome, 'dialog', 'developer')).toBe(false);
    expect(tierDenied(normative, 'dialog', 'developer')).toBe(true);
  });
});
