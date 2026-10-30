import { readFileSync } from 'node:fs';
import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';
import { ALL_MANIFEST_GROUPS } from '@texuli/catalog/manifests/all';
import { describe, expect, it } from 'vitest';
import { blueprintTool, systemPrompt, tierUEntries } from '../src/tools.ts';
import { build } from './helpers.ts';

describe('catalog and tool schema', () => {
  it('builds the same catalog as the file-system build (same hash as the site)', async () => {
    const reference = await buildCatalog(await discoverManifestGroups());
    expect(build.hash).toBe(reference.hash);
  });

  it('builds from the shared static list in @texuli/catalog/manifests/all', async () => {
    expect(build.hash).toBe((await buildCatalog(ALL_MANIFEST_GROUPS)).hash);
    const source = readFileSync(new URL('../src/catalog.ts', import.meta.url), 'utf8');
    expect(source).toContain("from '@texuli/catalog/manifests/all'");
    expect(source).not.toMatch(/from '@texuli\/catalog\/manifests\/(?!all')/u);
  });

  it('offers the model exactly the Tier U ids, without slots, events or CSS hooks', () => {
    const tool = blueprintTool(build.catalog);
    const variants = (
      tool.inputSchema as {
        $defs: {
          node: {
            oneOf: {
              properties: { id: { const: string }; props: { properties: Record<string, unknown> } };
            }[];
          };
        };
      }
    ).$defs.node.oneOf;
    expect(variants.map((v) => v.properties.id.const)).toEqual(
      [...build.catalog.tiers.untrusted].sort()
    );
    expect(variants.map((v) => v.properties.id.const)).not.toContain('dialog');
    for (const variant of variants) {
      const names = Object.keys(variant.properties.props.properties);
      const entry = build.catalog.entries.find((e) => e.id === variant.properties.id.const);
      for (const name of names) {
        const prop = entry?.props.find((p) => p.name === name);
        expect(['slot', 'event']).not.toContain(prop?.kind);
        expect(['class', 'className', 'style']).not.toContain(name);
      }
    }
  });

  it('writes the rules and each Tier U component into the system prompt', () => {
    const prompt = systemPrompt(build.catalog);
    expect(prompt).toContain('fictional data only');
    for (const entry of tierUEntries(build.catalog)) expect(prompt).toContain(`- ${entry.id}: `);
  });
});
