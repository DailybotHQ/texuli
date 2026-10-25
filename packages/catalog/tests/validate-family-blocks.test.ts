// @vitest-environment node

import { checkCodeBlock } from '@texuli/blocks/code/engine';
import { safeParseBlock } from '@texuli/blocks/core';
import { checkDataBlock } from '@texuli/blocks/data/engine';
import { checkEmbedBlock } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock } from '@texuli/blocks/interactive/engine';
import { checkMapBlock } from '@texuli/blocks/map/engine';
import { checkMediaBlock } from '@texuli/blocks/media/engine';
import { checkStructureBlock } from '@texuli/blocks/structure/engine';
import { checkTextBlock } from '@texuli/blocks/text/engine';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import {
  BLOCK_FAMILY_TYPES,
  blockFamilyMismatch,
  type RenderCatalog,
  renderCatalogFromBuild,
} from '../src/render/renderer/index.ts';
import { createFamilyBlockCheck, diagramFamilyCheck } from '../src/validate/blocks.ts';
import { validateDraft } from '../src/validate/index.ts';

/**
 * Audit G05 hardening: a `blocks-*` node is checked by the parser of the
 * family that renders it, and the family lookup fails closed.
 */

/** The same assembly the golden scorer, the player and the agent service run. */
const FAMILY_BLOCK_CHECKS = {
  'blocks-code': checkCodeBlock,
  'blocks-data': checkDataBlock,
  'blocks-diagram': diagramFamilyCheck,
  'blocks-embed': checkEmbedBlock,
  'blocks-interactive': checkInteractiveBlock,
  'blocks-map': checkMapBlock,
  'blocks-media': checkMediaBlock,
  'blocks-structure': checkStructureBlock,
  'blocks-text': checkTextBlock,
};
const checkFamilyBlock = createFamilyBlockCheck(FAMILY_BLOCK_CHECKS);

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);
const blockEntries = build.catalog.entries.filter((entry) => entry.id.startsWith('blocks-'));

/** One valid block per type the core parser does not know. */
const FAMILY_ONLY_BLOCKS: Readonly<Record<string, Record<string, unknown>>> = {
  'blocks-diagram': {
    type: 'flow',
    nodes: [
      { id: 'plan', label: 'Plan' },
      { id: 'ship', label: 'Ship' },
    ],
    edges: [{ from: 'plan', to: 'ship' }],
  },
  'blocks-embed': {
    type: 'link-preview',
    href: 'https://example.com/guide',
    title: 'Product guide',
  },
  'blocks-map': {
    type: 'map',
    label: 'Fictional harbor',
    points: [{ id: 'north', label: 'North Pier', lat: 10, lng: 20 }],
  },
};

/**
 * Manifest examples their own family refuses. `src/manifests/**` is frozen for
 * this task, so each is reported to the manifest owner instead of edited. The
 * test asserts they stay refused, so it fails (and this list must shrink)
 * once the manifest is fixed.
 */
const KNOWN_INVALID_EXAMPLES: Readonly<Record<string, string>> = {};

describe('checkFamilyBlock', () => {
  it('covers exactly the block families the renderer knows', () => {
    expect(Object.keys(FAMILY_BLOCK_CHECKS).sort()).toEqual(Object.keys(BLOCK_FAMILY_TYPES).sort());
    expect(blockEntries.map((entry) => entry.id).sort()).toEqual(
      Object.keys(BLOCK_FAMILY_TYPES).sort()
    );
  });

  it('validates every block family example, except the reported ones', () => {
    for (const entry of blockEntries) {
      for (const example of entry.examples ?? []) {
        const props = (example as { props?: Record<string, unknown> }).props ?? example;
        const result = validateDraft(
          { id: entry.id, props },
          { catalog, checkBlock: checkFamilyBlock, frameRoots: false }
        );
        const known = KNOWN_INVALID_EXAMPLES[entry.id];
        if (known) {
          expect(
            result.diagnostics.map((d) => d.message),
            entry.id
          ).toEqual([known]);
          continue;
        }
        expect(result.diagnostics, entry.id).toEqual([]);
        expect(result.ok, entry.id).toBe(true);
      }
    }
  });

  it.each(Object.entries(FAMILY_ONLY_BLOCKS))(
    'accepts a %s block the core parser does not know',
    (id, block) => {
      expect(safeParseBlock(block).success).toBe(false);
      expect(checkFamilyBlock(block, id)).toEqual({ success: true });
    }
  );

  it('refuses a block of another family, a missing type and an invalid block', () => {
    expect(checkFamilyBlock({ type: 'text', markdown: 'Hi' }, 'blocks-map')).toMatchObject({
      success: false,
    });
    expect(checkFamilyBlock({ markdown: 'Hi' }, 'blocks-text')).toMatchObject({ success: false });
    expect(checkFamilyBlock([{ type: 'text' }], 'blocks-text')).toMatchObject({ success: false });
    const invalid = checkFamilyBlock(
      {
        type: 'flow',
        nodes: [
          { id: 'plan', label: 'Plan' },
          { id: 'Bad Id', label: 'Ship' },
        ],
        edges: [],
      },
      'blocks-diagram'
    );
    expect(invalid).toMatchObject({ success: false, issues: [{ path: ['nodes', 1, 'id'] }] });
  });

  it('fails closed for an id with no block family, prototype names included', () => {
    for (const id of ['blocks-carousel', 'layout-card', 'constructor', '__proto__', 'toString']) {
      const result = checkFamilyBlock({ type: 'text', markdown: 'Hi' }, id);
      expect(result, id).toMatchObject({ success: false });
    }
  });
});

describe('blockFamilyMismatch hardening', () => {
  it('never reaches Object.prototype for prototype-named ids', () => {
    for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(() => blockFamilyMismatch(id, { block: { type: 'text' } }), id).not.toThrow();
      expect(blockFamilyMismatch(id, { block: { type: 'text' } }), id).toBeNull();
    }
  });

  it('refuses a blocks-* id with no known family', () => {
    expect(blockFamilyMismatch('blocks-carousel', { block: { type: 'text' } })).toContain(
      'no known block family'
    );
  });

  it('keeps a host catalog with such ids from stopping validation', () => {
    const blockSpec = catalog.get('blocks-text');
    if (!blockSpec) throw new Error('blocks-text is missing from the catalog');
    const host: RenderCatalog = {
      get: (id) => (id === 'constructor' || id === 'blocks-carousel' ? blockSpec : catalog.get(id)),
      allows: () => true,
    };
    for (const id of ['constructor', 'blocks-carousel']) {
      const result = validateDraft(
        { id, props: { block: { type: 'text', markdown: 'Hi' } } },
        { catalog: host, frameRoots: false }
      );
      const codes = result.diagnostics.map((d) => d.code);
      expect(codes, id).not.toContain('internal-error');
      if (id === 'blocks-carousel') expect(codes).toContain('block-family-mismatch');
    }
  });
});
