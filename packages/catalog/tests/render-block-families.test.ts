// @vitest-environment node

import { CODE_BLOCK_TYPES, checkCodeBlock } from '@texuli/blocks/code/engine';
import { BLOCK_TYPES } from '@texuli/blocks/core';
import { DATA_BLOCK_TYPES } from '@texuli/blocks/data/engine';
import { DIAGRAM_BLOCK_TYPES } from '@texuli/blocks/diagram/engine';
import { EMBED_BLOCK_TYPES } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock, INTERACTIVE_BLOCK_TYPES } from '@texuli/blocks/interactive/engine';
import { checkMapBlock, MAP_BLOCK_TYPES } from '@texuli/blocks/map/engine';
import { MEDIA_BLOCK_TYPES } from '@texuli/blocks/media/engine';
import { checkStructureBlock, STRUCTURE_BLOCK_TYPES } from '@texuli/blocks/structure/engine';
import { TEXT_BLOCK_TYPES } from '@texuli/blocks/text/engine';
import { describe, expect, it } from 'vitest';
import { buildCatalog, isTierU } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { CONTENT_MANIFESTS, contentManifestsById } from '../src/manifests/content/index.ts';
import {
  BLOCK_FAMILY_TYPES,
  blockFamilyIdFor,
  renderCatalogFromBuild,
  renderCatalogTree,
} from '../src/render/renderer/index.ts';

/**
 * Audit G05: every schema-valid block type has a catalog id that renders it,
 * and a block of another family is refused in validation instead of painting
 * the family's inert "invalid" notice.
 */

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);

/** One schema-valid block per type the audit found without a rendering id. */
const AUDIT_G05_BLOCKS: Readonly<Record<string, Record<string, unknown>>> = {
  cta: { type: 'cta', actions: [{ label: 'Start a trial', href: 'https://example.com/signup' }] },
  cards: {
    type: 'cards',
    items: [{ title: 'Boards', body: 'See the week.', href: 'https://example.com/boards' }],
  },
  columns: {
    type: 'columns',
    columns: [[{ type: 'text', markdown: 'Left' }], [{ type: 'text', markdown: 'Right' }]],
  },
  tabs: {
    type: 'tabs',
    id: 'plans',
    label: 'Plans',
    panels: [
      { id: 'free', label: 'Free', blocks: [{ type: 'text', markdown: 'Up to five seats.' }] },
      { id: 'team', label: 'Team', blocks: [{ type: 'text', markdown: 'Up to fifty seats.' }] },
    ],
  },
  accordion: {
    type: 'accordion',
    items: [{ id: 'trial', title: 'Is there a free trial?', body: 'Yes, for 14 days.' }],
  },
  grid: { type: 'grid', cells: [{ title: 'Design', body: 'Tokens and themes.' }] },
  code: { type: 'code', lang: 'ts', code: 'const seats = 5;' },
  poll: {
    type: 'poll',
    id: 'q1',
    question: 'Which fictional harbor is busiest?',
    options: [
      { id: 'north', label: 'North Pier' },
      { id: 'south', label: 'South Basin' },
    ],
  },
  quiz: {
    type: 'quiz',
    title: 'Harbor basics',
    questions: [
      {
        id: 'q1',
        prompt: 'Which pier opens first?',
        options: [
          { id: 'north', label: 'North Pier' },
          { id: 'south', label: 'South Basin' },
        ],
        correctId: 'north',
      },
    ],
  },
  calculator: {
    type: 'calculator',
    title: 'Seat cost',
    inputs: [{ name: 'seats', label: 'Seats', default: 5, min: 1 }],
    formula: { op: 'mul', left: { op: 'var', name: 'seats' }, right: { op: 'num', value: 800 } },
    unit: 'cents',
    outputLabel: 'Monthly total',
  },
  checklist: {
    type: 'checklist',
    title: 'Launch checklist',
    items: [{ id: 'brief', label: 'Write the brief' }],
  },
  map: {
    type: 'map',
    label: 'North Pier depot',
    basemap: 'port-meridian',
    points: [{ id: 'depot', label: 'North Pier depot', lng: -18.6, lat: -30.4 }],
  },
};

const FAMILY_CHECKS: Readonly<Record<string, (block: unknown) => { ok: boolean }>> = {
  'blocks-structure': checkStructureBlock,
  'blocks-code': checkCodeBlock,
  'blocks-interactive': checkInteractiveBlock,
  'blocks-map': checkMapBlock,
};

describe('block family ids (G05)', () => {
  it('keeps the family map equal to the block packages type lists', () => {
    expect(BLOCK_FAMILY_TYPES).toEqual({
      'blocks-text': [...TEXT_BLOCK_TYPES],
      'blocks-data': [...DATA_BLOCK_TYPES],
      'blocks-media': [...MEDIA_BLOCK_TYPES],
      'blocks-diagram': [...DIAGRAM_BLOCK_TYPES],
      'blocks-embed': [...EMBED_BLOCK_TYPES],
      'blocks-structure': [...STRUCTURE_BLOCK_TYPES],
      'blocks-code': [...CODE_BLOCK_TYPES],
      'blocks-interactive': [...INTERACTIVE_BLOCK_TYPES],
      'blocks-map': [...MAP_BLOCK_TYPES],
    });
  });

  it('gives every blocks-* family a content manifest, and every core block type an id', () => {
    const manifestIds = CONTENT_MANIFESTS.map((m) => m.id).filter((id) => id.startsWith('blocks-'));
    expect(manifestIds.sort()).toEqual(Object.keys(BLOCK_FAMILY_TYPES).sort());
    for (const type of BLOCK_TYPES) {
      expect(blockFamilyIdFor(type), type).toBeDefined();
    }
  });

  it('puts the new family ids in the built catalog and in Tier U', () => {
    for (const id of ['blocks-structure', 'blocks-code', 'blocks-interactive', 'blocks-map']) {
      expect(catalog.get(id), id).toBeDefined();
      expect(isTierU(build.catalog, id), id).toBe(true);
    }
  });

  it('ships examples that their own family accepts', () => {
    for (const [id, check] of Object.entries(FAMILY_CHECKS)) {
      const manifest = contentManifestsById[id as keyof typeof contentManifestsById];
      for (const example of manifest.examples) {
        expect(check(example.props.block).ok, `${id} ${example.id}`).toBe(true);
      }
    }
  });

  it.each(Object.entries(AUDIT_G05_BLOCKS))(
    'renders a %s block through its own id at the untrusted tier',
    (type, block) => {
      const id = blockFamilyIdFor(type) as string;
      expect(FAMILY_CHECKS[id]?.(block).ok, `${type} is schema-valid`).toBe(true);
      const result = renderCatalogTree({ id, props: { block } }, { catalog, tier: 'untrusted' });
      expect(result.diagnostics).toEqual([]);
      expect(result.roots).toHaveLength(1);
      expect(result.roots[0]).toMatchObject({ kind: 'component', id });
    }
  );

  it.each(Object.entries(AUDIT_G05_BLOCKS))(
    'refuses a %s block under blocks-text instead of painting the invalid notice',
    (type, block) => {
      const result = renderCatalogTree(
        {
          id: 'layout-doc',
          props: { title: 'Plans' },
          children: [{ id: 'blocks-text', props: { block } }],
        },
        { catalog, tier: 'untrusted' }
      );
      const doc = result.roots[0];
      expect(doc?.kind === 'component' && doc.children).toEqual([]);
      const mismatch = result.diagnostics.find((d) => d.code === 'block-family-mismatch');
      expect(mismatch).toMatchObject({ path: '0.children.0', id: 'blocks-text' });
      expect(mismatch?.message).toContain(`"${blockFamilyIdFor(type)}"`);
      expect(result.diagnostics.map((d) => d.code)).toContain('schema-failure');
    }
  );

  it('refuses a block with no type, or a type no family renders', () => {
    for (const block of [{ text: 'No type' }, { type: 'carousel', items: [] }]) {
      const result = renderCatalogTree(
        { id: 'blocks-structure', props: { block } },
        { catalog, tier: 'untrusted' }
      );
      expect(result.roots).toEqual([]);
      expect(result.diagnostics.map((d) => d.code)).toContain('block-family-mismatch');
    }
  });

  it('leaves non-block ids alone', () => {
    const result = renderCatalogTree(
      { id: 'layout-card', props: { title: 'Summary' } },
      { catalog, tier: 'untrusted' }
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.roots).toHaveLength(1);
  });
});
