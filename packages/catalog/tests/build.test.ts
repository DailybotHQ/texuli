// @vitest-environment node
/// <reference types="node" />
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildCatalog,
  type CatalogBuild,
  CatalogBuildError,
  canonicalJson,
  emitTiers,
  isContentLayoutId,
  isTierU,
  type ManifestGroup,
  sha256Hex,
  verifyCatalog,
} from '../src/build/index.ts';
import {
  discoverManifestGroups,
  MANIFESTS_DIR,
  manifestsOf,
  writeCatalog,
} from '../src/build/node.ts';
import type { CatalogManifest } from '../src/manifest/index.ts';
import { scenario } from './scenario.ts';

const temp: string[] = [];
/** Runs after every test and between the scenarios of a grouped test. */
const reset = async () => {
  await Promise.all(temp.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
};
afterEach(reset);
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'texuli-catalog-'));
  temp.push(dir);
  return dir;
}

function manifest(id: string, overrides: Partial<CatalogManifest> = {}): CatalogManifest {
  const emittable = overrides.agentEmittable ?? false;
  return {
    id,
    package: 'texuli',
    label: id,
    summary: `The ${id} component.`,
    tier: 'app',
    useWhen: ['Showing something.'],
    dontUseWhen: ['Never.'],
    a11y: 'Keyboard and screen reader friendly.',
    props: [{ name: 'title', kind: 'string' }],
    examples: emittable ? [{ id: 'basic', title: 'Basic', props: { title: 'Hello' } }] : [],
    ...overrides,
  };
}

it('canonical JSON sorts, rejects non-JSON and hashes with SHA-256', async () => {
  await scenario(
    'sorts keys at every depth, drops undefined fields and rejects non-JSON',
    async () => {
      expect(canonicalJson({ b: 1, a: { d: [1, { z: true, y: null }], c: undefined } })).toBe(
        '{"a":{"d":[1,{"y":null,"z":true}]},"b":1}'
      );
      expect(() => canonicalJson({ a: Number.NaN })).toThrow('$.a');
      expect(() => canonicalJson({ a: () => 1 })).toThrow('$.a');
      expect(() => canonicalJson({ when: new Date(0) })).toThrow('$.when');
    },
    reset
  );
  await scenario(
    'hashes with SHA-256',
    async () => {
      expect(await sha256Hex('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
      );
    },
    reset
  );
});

describe('the catalog build', () => {
  const groups: ManifestGroup[] = [
    {
      name: 'content',
      manifests: [
        manifest('chart-bar', { tier: 'content', agentEmittable: true }),
        manifest('block-text', { tier: 'content', agentEmittable: true }),
      ],
    },
    {
      name: 'forms',
      manifests: [manifest('button'), manifest('picker', { agentEmittable: true })],
    },
  ];

  it('the build is content-addressed, order-independent, tamper-evident, grouped and strict', async () => {
    await scenario(
      'is content-addressed: the file name is the SHA-256 of its exact bytes',
      async () => {
        const build = await buildCatalog(groups);
        expect(build.hash).toBe(await sha256Hex(build.json));
        expect(build.fileName).toBe(`catalog-${build.hash}.json`);
        expect(build.json).toBe(canonicalJson(build.catalog));
        expect(await verifyCatalog(build.fileName, build.json)).toEqual(build.catalog);
        expect(await verifyCatalog(`out/${build.fileName}`, build.json)).not.toBeNull();
      },
      reset
    );
    await scenario(
      'gives the same address whatever the input order, and a new one for any change',
      async () => {
        const a = await buildCatalog(groups);
        const reversed = [...groups]
          .reverse()
          .map((group) => ({ ...group, manifests: [...group.manifests].reverse() }));
        expect((await buildCatalog(reversed)).hash).toBe(a.hash);
        const edited = structuredClone(groups);
        (edited[1]?.manifests[0] as CatalogManifest).summary = 'Changed.';
        expect((await buildCatalog(edited)).hash).not.toBe(a.hash);
      },
      reset
    );
    await scenario(
      'refuses tampered or misnamed files',
      async () => {
        const build = await buildCatalog(groups);
        expect(
          await verifyCatalog(build.fileName, build.json.replace('chart-bar', 'chart-baz'))
        ).toBeNull();
        expect(await verifyCatalog('catalog.json', build.json)).toBeNull();
        expect(await verifyCatalog(`catalog-${'0'.repeat(64)}.json`, build.json)).toBeNull();
      },
      reset
    );
    await scenario(
      'records each entry with its group, sorted, and lists groups and tiers',
      async () => {
        const { catalog } = await buildCatalog(groups);
        expect(catalog.format).toBe('texuli-catalog');
        expect(catalog.entries.map((entry) => entry.id)).toEqual([
          'block-text',
          'button',
          'chart-bar',
          'picker',
        ]);
        expect(catalog.groups).toEqual({
          content: ['block-text', 'chart-bar'],
          forms: ['button', 'picker'],
        });
        expect(catalog.entries.find((entry) => entry.id === 'button')?.emit).toEqual([]);
        // An emittable app-tier component is for developer trees only.
        expect(catalog.tiers).toEqual({
          developer: ['block-text', 'chart-bar', 'picker'],
          untrusted: ['block-text', 'chart-bar'],
        });
        expect(isTierU(catalog, 'chart-bar')).toBe(true);
        expect(isTierU(catalog, 'picker')).toBe(false);
      },
      reset
    );
    await scenario(
      'fails on invalid manifests, duplicate ids across groups and bad groups',
      async () => {
        const bad = async (input: ManifestGroup[]) => {
          try {
            await buildCatalog(input);
          } catch (error) {
            expect(error).toBeInstanceOf(CatalogBuildError);
            return (error as CatalogBuildError).diagnostics.map((d) => d.code);
          }
          throw new Error('expected a failure');
        };
        expect(await bad([{ name: 'a', manifests: [manifest('Not An Id')] }])).toContain(
          'invalid-id'
        );
        expect(
          await bad([
            { name: 'a', manifests: [manifest('card')] },
            { name: 'b', manifests: [manifest('card')] },
          ])
        ).toContain('duplicate-id');
        expect(await bad([{ name: 'Bad Name', manifests: [] }])).toContain('invalid-group');
        expect(
          await bad([
            { name: 'a', manifests: [] },
            { name: 'a', manifests: [] },
          ])
        ).toContain('duplicate-group');
      },
      reset
    );
  });
});

it('Tier U holds content components and layouts only, never overlays, focus traps or shells', async () => {
  await scenario(
    'holds content components and content layouts only',
    async () => {
      const content = manifest('chart-line', { tier: 'content', agentEmittable: true });
      expect(emitTiers(content, 'content')).toEqual(['developer', 'untrusted']);
      expect(emitTiers({ ...content, agentEmittable: false }, 'content')).toEqual([]);
      for (const id of ['card', 'page', 'doc', 'deck', 'grid', 'layout-grid', 'deck-layout']) {
        expect(isContentLayoutId(id)).toBe(true);
        expect(emitTiers(manifest(id, { agentEmittable: true }), 'layouts')).toContain('untrusted');
      }
      expect(isContentLayoutId('cards')).toBe(false);
    },
    reset
  );
  await scenario(
    'never holds overlays, focus traps or shells',
    async () => {
      for (const id of ['app-shell', 'shell-sidebar', 'sidebar', 'navbar']) {
        expect(
          emitTiers(manifest(id, { tier: 'content', agentEmittable: true }), 'layouts')
        ).toEqual(['developer']);
      }
      expect(
        emitTiers(manifest('breadcrumb', { tier: 'content', agentEmittable: true }), 'navigation')
      ).toEqual(['developer']);
      // An agent-emittable overlay or focus trap is a contradiction: the build fails.
      for (const [id, group] of [
        ['dialog', 'content'],
        ['context-menu', 'display'],
        ['date-popover', 'forms'],
        ['tabs-panel', 'overlays'],
      ] as const) {
        await expect(
          buildCatalog([
            { name: group, manifests: [manifest(id, { tier: 'content', agentEmittable: true })] },
          ])
        ).rejects.toMatchObject({
          diagnostics: [expect.objectContaining({ code: 'overlay-emittable' })],
        });
      }
      // Non-emittable overlays are fine (tier app chrome).
      const ok = await buildCatalog([{ name: 'overlays', manifests: [manifest('dialog')] }]);
      expect(ok.catalog.tiers.untrusted).toEqual([]);
    },
    reset
  );
});

describe('the real catalog', () => {
  let build: CatalogBuild;

  it('the real catalog reads every group, keeps Tier U to emittable content, relates only known ids and writes verifiable bytes', async () => {
    await scenario(
      'reads every manifest group folder present at build time',
      async () => {
        const folders = (await readdir(MANIFESTS_DIR, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort();
        const groups = await discoverManifestGroups();
        expect(groups.map((group) => group.name)).toEqual(folders);
        expect(folders).toEqual(expect.arrayContaining(['content', 'display', 'forms']));
        build = await buildCatalog(groups);
        for (const group of groups) {
          expect(build.catalog.groups[group.name]).toEqual(group.manifests.map((m) => m.id).sort());
          expect(group.manifests.length).toBeGreaterThan(0);
        }
      },
      reset
    );
    await scenario(
      'puts only content-tier, emittable, non-chrome components in Tier U',
      async () => {
        const { catalog } = build;
        expect(catalog.tiers.untrusted.length).toBeGreaterThan(0);
        for (const id of catalog.tiers.untrusted) {
          const entry = catalog.entries.find((item) => item.id === id);
          expect(entry?.agentEmittable).toBe(true);
          expect(
            entry?.group === 'layouts' ? isContentLayoutId(id) : entry?.tier === 'content'
          ).toBe(true);
          expect(['overlays', 'navigation', 'shells']).not.toContain(entry?.group);
        }
        // The form and display chrome of today is not emittable at all.
        for (const id of [...(catalog.groups.forms ?? []), ...(catalog.groups.display ?? [])]) {
          expect(catalog.tiers.developer).not.toContain(id);
        }
      },
      reset
    );
    await scenario(
      'relates every entry only to ids the catalog holds',
      async () => {
        const ids = new Set(build.catalog.entries.map((entry) => entry.id));
        const dangling = build.catalog.entries.flatMap((entry) =>
          (entry.related ?? []).filter((id) => !ids.has(id)).map((id) => `${entry.id} → ${id}`)
        );
        expect(dangling).toEqual([]);
      },
      reset
    );
    await scenario(
      'writes catalog-<sha256>.json that verifies, the same bytes every time',
      async () => {
        const out = await tempDir();
        const first = await writeCatalog(out);
        const second = await writeCatalog(out);
        expect(second.path).toBe(first.path);
        expect(first.path.endsWith(`catalog-${first.hash}.json`)).toBe(true);
        const text = await readFile(first.path, 'utf8');
        expect(text).toBe(build.json);
        expect(await verifyCatalog(first.path, text)).not.toBeNull();
        expect(await readdir(out)).toEqual([first.fileName]);
      },
      reset
    );
  });
});

it('manifest group discovery picks up later groups and collects each manifest once', async () => {
  await scenario(
    'picks up groups that land later (overlays, layouts) with no build change',
    async () => {
      const dir = await tempDir();
      const group = async (name: string, body: string) => {
        await mkdir(join(dir, name));
        await writeFile(join(dir, name, 'index.ts'), body);
      };
      const shape = (id: string, extra = '') =>
        `{ id: '${id}', package: 'texuli', label: '${id}', summary: 'The ${id}.', tier: 'app', useWhen: ['a'], dontUseWhen: ['b'], a11y: 'c', props: [], examples: [${extra ? "{ id: 'basic', title: 'Basic', props: {} }" : ''}]${extra} }`;
      await group(
        'overlays',
        `export const OVERLAY_MANIFESTS = [${shape('dialog')}, ${shape('popover')}];\nexport const dialogManifest = OVERLAY_MANIFESTS[0];\nexport const OTHER = [1, 2];`
      );
      await group(
        'layouts',
        `export const LAYOUT_MANIFESTS = [${shape('page', ', agentEmittable: true')}, ${shape('app-shell', ', agentEmittable: true')}];`
      );
      await mkdir(join(dir, 'drafts'));
      const groups = await discoverManifestGroups(dir);
      expect(groups.map((g) => [g.name, g.manifests.map((m) => m.id)])).toEqual([
        ['layouts', ['page', 'app-shell']],
        ['overlays', ['dialog', 'popover']],
      ]);
      const { catalog } = await buildCatalog(groups);
      expect(catalog.groups).toEqual({
        layouts: ['app-shell', 'page'],
        overlays: ['dialog', 'popover'],
      });
      expect(catalog.tiers).toEqual({ developer: ['app-shell', 'page'], untrusted: ['page'] });
    },
    reset
  );
  await scenario(
    'collects exported lists and single manifests once each',
    async () => {
      const a = manifest('a');
      const b = manifest('b');
      expect(manifestsOf({ ALL: [a, b], a, SOME: [b], count: 2, names: ['a'] })).toEqual([a, b]);
    },
    reset
  );
});
