// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { discoverManifestGroups } from '../src/build/node.ts';
import {
  defineCatalogManifest,
  manifestData,
  validateCatalogManifest,
  validateCatalogManifests,
} from '../src/manifest/index.ts';

/**
 * The manifest groups build their entries with `manifestData` (normalized,
 * frozen data without the validator, so runtimes such as the player stay
 * small). Validation is not skipped: every entry of every group is valid,
 * and equals what `defineCatalogManifest` makes of it.
 */
describe('validator-free manifest data', () => {
  it('every group entry passes the validator and equals its validated form', async () => {
    const groups = await discoverManifestGroups();
    const all = groups.flatMap((group) => group.manifests);
    expect(all.length).toBeGreaterThan(150);
    expect(validateCatalogManifests(all).diagnostics).toEqual([]);
    for (const manifest of all) {
      expect(validateCatalogManifest(manifest).diagnostics, manifest.id).toEqual([]);
      expect(defineCatalogManifest(manifest), manifest.id).toEqual(manifest);
      expect(Object.isFrozen(manifest), manifest.id).toBe(true);
    }
  });

  it('the literal grammar role lists name exactly their group ids', async () => {
    const { DATA_GRAMMAR_ROLES, DATA_MANIFESTS } = await import('../src/manifests/data/index.ts');
    const { CHAT_GRAMMAR_ROLES, CHAT_MANIFESTS } = await import('../src/manifests/chat/index.ts');
    const { WORKFLOWS_GRAMMAR_ROLES, WORKFLOWS_MANIFESTS } = await import(
      '../src/manifests/workflows/index.ts'
    );
    const { STATE_GRAMMAR_ROLES, STATE_MANIFESTS } = await import(
      '../src/manifests/state/index.ts'
    );
    const { COMPOSITION_GRAMMAR_ROLES, COMPOSITION_MANIFESTS } = await import(
      '../src/manifests/composition/index.ts'
    );
    const ids = (list: readonly { id: string }[]) => list.map((entry) => entry.id).sort();
    expect(ids(DATA_GRAMMAR_ROLES)).toEqual(ids(DATA_MANIFESTS));
    expect(ids(CHAT_GRAMMAR_ROLES)).toEqual(ids(CHAT_MANIFESTS));
    expect(ids(WORKFLOWS_GRAMMAR_ROLES)).toEqual(ids(WORKFLOWS_MANIFESTS));
    expect(ids(STATE_GRAMMAR_ROLES)).toEqual(ids(STATE_MANIFESTS));
    expect(ids(COMPOSITION_GRAMMAR_ROLES)).toEqual(ids(COMPOSITION_MANIFESTS));
  });

  it('manifestData normalizes like defineCatalogManifest but never validates', () => {
    const input = {
      id: ' sample ',
      package: 'texuli',
      label: ' Sample ',
      summary: ' A sample. ',
      tier: 'content' as const,
      useWhen: [' x '],
      dontUseWhen: [' y '],
      a11y: ' z ',
      props: [],
      examples: [],
    };
    expect(manifestData(input)).toEqual(defineCatalogManifest(input));
    expect(manifestData(input).agentEmittable).toBe(false);
    // An invalid manifest is data here; the catalog build is what refuses it.
    expect(() => manifestData({ ...input, id: 'Not Valid' })).not.toThrow();
    expect(() => defineCatalogManifest({ ...input, id: 'Not Valid' })).toThrow();
  });
});
