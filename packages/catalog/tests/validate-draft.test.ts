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
import { createEditHistory } from '../src/edit/index.ts';
import { grammarRolesFromList } from '../src/render/grammar/index.ts';
import {
  BLOCK_FAMILY_TYPES,
  blockFamilyMismatch,
  type CatalogTreeInput,
  type RenderCatalog,
  renderCatalogFromBuild,
} from '../src/render/renderer/index.ts';
import { createFamilyBlockCheck, diagramFamilyCheck } from '../src/validate/blocks.ts';
import {
  DRAFT_CHECKS,
  type DraftValidation,
  draftCommitGate,
  scanSinks,
  validateDraft,
} from '../src/validate/index.ts';

const build = await buildCatalog(await discoverManifestGroups());

describe('validateDraft', () => {
  const catalog = renderCatalogFromBuild(build.catalog);

  const heading = (level: number, text: string): CatalogTreeInput => ({
    id: 'blocks-text',
    props: { block: { type: 'heading', level, text } },
  });
  const paragraph = (markdown: string): CatalogTreeInput => ({
    id: 'blocks-text',
    props: { block: { type: 'text', markdown } },
  });
  const doc = (...children: CatalogTreeInput[]): CatalogTreeInput => ({
    id: 'layout-doc',
    props: { title: 'Week 42 report' },
    children,
  });
  const VALID = doc(heading(2, 'Highlights'), paragraph('Shipped **on time**.'));

  const codes = (result: DraftValidation) => result.diagnostics.map((d) => `${d.check}:${d.code}`);

  describe('validateDraft: a valid draft', () => {
    it('a valid draft passes, from text, with fragments when the root rule is off', () => {
      // passes every check it runs and returns the render tree and a clean draft
      {
        const result = validateDraft(VALID, { catalog, checkBlock: safeParseBlock });
        expect(result.diagnostics).toEqual([]);
        expect(result).toMatchObject({ ok: true, status: 'valid', tier: 'untrusted' });
        expect(result.checks).toEqual(
          Object.fromEntries(DRAFT_CHECKS.map((c) => [c, c === 'envelope' ? 'skipped' : 'pass']))
        );
        expect(result.envelope).toBeNull();
        expect(result.roots[0]).toMatchObject({ kind: 'component', id: 'layout-doc' });
        expect(result.draft).toEqual(VALID);
      }
      // reads JSON text, and marks the block schema skipped when the host gives none
      {
        const result = validateDraft(JSON.stringify(VALID, null, 2), { catalog });
        expect(result.ok).toBe(true);
        expect(result.checks.blocks).toBe('skipped');
        expect(result.checks.input).toBe('pass');
      }
      // accepts fragments and arrays when the host turns the root rule off
      {
        expect(validateDraft(paragraph('Hi'), { catalog }).ok).toBe(false);
        const fragment = validateDraft([paragraph('One'), paragraph('Two')], {
          catalog,
          frameRoots: false,
        });
        expect(fragment.ok).toBe(true);
        expect(fragment.checks.root).toBe('skipped');
      }
    });
  });

  describe('validateDraft: input', () => {
    it('input: oversized text, bad JSON, non-trees and a tighter cap', () => {
      // refuses oversized text before parsing, bad JSON and non-trees
      {
        const big = validateDraft(' '.repeat(300 * 1024), { catalog });
        expect(big).toMatchObject({ ok: false, status: 'parse', draft: null });
        expect(codes(big)).toEqual(['input:too-large']);
        expect(codes(validateDraft('{"id": ', { catalog }))).toEqual(['input:bad-json']);
        for (const value of ['"text"', '42', 'null', 7, null, undefined]) {
          const result = validateDraft(value, { catalog });
          expect(result.status, String(value)).toBe('parse');
          expect(codes(result)).toEqual(['input:not-a-tree']);
        }
      }
      // respects a tighter text cap
      {
        const result = validateDraft(JSON.stringify(VALID), { catalog, maxTextBytes: 64 });
        expect(codes(result)).toEqual(['input:too-large']);
      }
    });
  });

  describe('validateDraft: hostile structure', () => {
    it('hostile structure: unknown fields, prototype keys, depth bombs, deep trees and throwing objects', () => {
      // reports unknown node fields and strips them from the draft
      {
        const result = validateDraft({ ...VALID, script: 'x', meta: { a: 1 } }, { catalog });
        expect(result.ok).toBe(false);
        expect(codes(result)).toEqual(['structure:unknown-field', 'structure:unknown-field']);
        expect(result.draft).toEqual(VALID);
      }
      // reports prototype keys anywhere, in parsed JSON and in objects
      {
        const text =
          '{"id":"layout-doc","__proto__":{"polluted":1},"props":{"title":"T","constructor":{"prototype":{"x":1}}}}';
        const result = validateDraft(text, { catalog });
        expect(result.ok).toBe(false);
        const paths = result.diagnostics
          .filter((d) => d.code === 'prototype-key')
          .map((d) => d.path)
          .sort();
        expect(paths).toEqual(['$.__proto__', '$.props.constructor']);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      }
      // refuses a depth bomb in props or in a bare array without overflowing the stack
      {
        let deep: unknown = 'end';
        for (let i = 0; i < 20_000; i += 1) deep = [deep];
        const props = validateDraft(
          { id: 'layout-doc', props: { title: 'T', data: deep } },
          { catalog }
        );
        expect(props).toMatchObject({ ok: false, status: 'over-limits', draft: null, roots: [] });
        expect(codes(props)).toEqual(['structure:too-deep']);
        const text = `${'['.repeat(100_000)}${']'.repeat(100_000)}`;
        expect(codes(validateDraft(text, { catalog, frameRoots: false }))).toContain(
          'structure:too-deep'
        );
      }
      // refuses a deep node tree through the limits
      {
        let cursor: CatalogTreeInput = { id: 'layout-card', props: {} };
        for (let i = 0; i < 20; i += 1)
          cursor = { id: 'layout-card', props: {}, children: [cursor] };
        const result = validateDraft(doc(cursor), { catalog });
        expect(result).toMatchObject({ ok: false, status: 'over-limits', draft: null });
        expect(codes(result)).toContain('limits:depth-exceeded');
      }
      // fails closed instead of throwing on an object that throws
      {
        const trap = {
          get id(): string {
            throw new Error('boom');
          },
        };
        const result = validateDraft(trap, { catalog });
        expect(result.ok).toBe(false);
        expect(codes(result)).toContain('input:internal-error');
      }
    });
  });

  describe('validateDraft: sinks, renderer, blocks, grammar and root', () => {
    it('sinks, renderer tier, block families, grammar and the frame root', () => {
      // reports raw sinks the renderer would have cleaned
      {
        const result = validateDraft(
          doc(paragraph('[Open](javascript:alert(1))'), {
            id: 'charts-funnel',
            props: {
              title: 'Funnel',
              steps: [{ id: 'a', label: 'javascript:alert(1)', value: 1 }],
            },
          }),
          { catalog }
        );
        const sinks = result.diagnostics.filter((d) => d.check === 'sinks');
        expect(sinks.map((d) => d.path)).toEqual([
          'tree.children[0].props.block.markdown',
          'tree.children[1].props.steps[0].label',
        ]);
        expect(result.checks.sinks).toBe('fail');
      }
      // runs the renderer at the host tier: the developer tier is the emittable ids (D5)
      {
        const tree = doc({ id: 'dialog', props: { title: 'Hi' } });
        expect(codes(validateDraft(tree, { catalog }))).toContain('render:tier-denied');
        const developer = validateDraft(tree, { catalog, tier: 'developer' });
        expect(developer.tier).toBe('developer');
        expect(codes(developer)).toContain('render:tier-denied');
        const chrome = renderCatalogFromBuild(build.catalog, { developer: 'all' });
        const trusted = validateDraft(tree, { catalog: chrome, tier: 'developer' });
        expect(codes(trusted)).not.toContain('render:tier-denied');
      }
      // reports a block of another family, and deep block schemas through the host check
      {
        const cta = { type: 'cta', actions: [{ label: 'Go', href: 'https://example.com' }] };
        expect(
          codes(validateDraft(doc({ id: 'blocks-text', props: { block: cta } }), { catalog }))
        ).toEqual(['render:block-family-mismatch', 'render:schema-failure']);
        const result = validateDraft(doc(heading(9, 'Too deep')), {
          catalog,
          checkBlock: safeParseBlock,
        });
        expect(codes(result)).toEqual(['blocks:block-schema', 'grammar:heading-level-invalid']);
        expect(result.diagnostics[0]).toMatchObject({ path: '0.children.0', id: 'blocks-text' });
      }
      // fails on grammar errors and keeps warnings informational
      {
        const twoH1 = validateDraft(doc(heading(1, 'A'), heading(2, 'B')), { catalog });
        expect(twoH1.ok).toBe(false);
        expect(codes(twoH1)).toEqual(['grammar:heading-multiple-h1']);
        const roles = grammarRolesFromList([
          { id: 'layout-doc', role: 'landmark', landmark: 'main' },
          { id: 'layout-card', role: 'landmark', landmark: 'navigation' },
        ]);
        const warned = validateDraft(
          doc({ id: 'layout-card', props: {} }, { id: 'layout-card', props: {} }),
          { catalog, roles }
        );
        expect(codes(warned)).toEqual(['grammar:landmark-duplicate']);
        expect(warned.diagnostics[0]?.severity).toBe('warning');
        expect(warned.ok).toBe(true);
      }
      expect(codes(validateDraft(paragraph('Bare'), { catalog }))).toEqual(['root:frame-root']);
      expect(codes(validateDraft([VALID, VALID], { catalog }))).toContain('root:root-count');
      expect(codes(validateDraft(VALID, { catalog, frameRoots: ['layout-page'] }))).toEqual([
        'root:frame-root',
      ]);
    });
  });

  describe('scanSinks', () => {
    it('scanSinks finds every sink at any depth and judges srcset by tier', () => {
      // finds forbidden keys, handlers, HTML, bidi controls and refused URLs at any depth
      {
        const findings = scanSinks({
          id: 'layout-doc',
          props: {
            style: 'color: red',
            onClick: 'go()',
            nested: [{ body: '<b>x</b>', note: `a${String.fromCharCode(0x202e)}b` }],
            imageSrc: 'ftp://files.example.com/a.png',
          },
        }).map((f) => `${f.path}: ${f.message}`);
        expect(findings).toEqual([
          'tree.props.style: a forbidden "style" key',
          'tree.props.onClick: an event handler key',
          'tree.props.nested[0].body: an HTML string',
          'tree.props.nested[0].note: a bidi control character',
          'tree.props.imageSrc: a URL the untrusted URL policy refuses',
        ]);
      }
      // judges srcset candidates with the tier image policy, like the paint pass
      {
        const refused = scanSinks({
          id: 'media-image',
          props: {
            srcset: 'http://evil.example/track.webp 1x, http://evil.example/track2x.webp 2x',
          },
        }).map((f) => `${f.path}: ${f.message}`);
        expect(refused).toEqual(['tree.props.srcset: a URL the untrusted URL policy refuses']);

        const kept = scanSinks({
          id: 'media-image',
          props: { srcset: 'https://example.com/a.webp 1x, https://example.com/a2x.webp 2x' },
        });
        expect(kept).toEqual([]);
      }
    });
  });

  describe('draftCommitGate', () => {
    it('lets createEditHistory refuse an edit that only the full validation catches', () => {
      const dialog = {
        op: 'insert',
        parent: [],
        index: 0,
        node: { id: 'dialog', props: {} },
      } as const;
      // The default gate (tree limits) commits it.
      expect(createEditHistory(VALID).apply(dialog).ok).toBe(true);
      const history = createEditHistory(VALID, { validate: draftCommitGate({ catalog }) });
      const refused = history.apply(dialog);
      expect(refused.ok).toBe(false);
      if (!refused.ok) {
        expect(refused.error.code).toBe('validation-failed');
        expect(JSON.stringify(refused.error.diagnostics)).toContain('tier-denied');
      }
      expect(history.tree).toBe(VALID);
      expect(
        history.apply({ op: 'insert', parent: [], index: 2, node: paragraph('More') }).ok
      ).toBe(true);
    });
  });
});

describe('block family checks', () => {
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
    it('checkFamilyBlock covers every family, accepts its examples and family-only blocks, and fails closed', () => {
      expect(Object.keys(FAMILY_BLOCK_CHECKS).sort()).toEqual(
        Object.keys(BLOCK_FAMILY_TYPES).sort()
      );
      expect(blockEntries.map((entry) => entry.id).sort()).toEqual(
        Object.keys(BLOCK_FAMILY_TYPES).sort()
      );
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
      for (const [id, block] of Object.entries(FAMILY_ONLY_BLOCKS)) {
        expect(safeParseBlock(block).success, id).toBe(false);
        expect(checkFamilyBlock(block, id), id).toEqual({ success: true });
      }
      // refuses a block of another family, a missing type and an invalid block
      {
        expect(checkFamilyBlock({ type: 'text', markdown: 'Hi' }, 'blocks-map')).toMatchObject({
          success: false,
        });
        expect(checkFamilyBlock({ markdown: 'Hi' }, 'blocks-text')).toMatchObject({
          success: false,
        });
        expect(checkFamilyBlock([{ type: 'text' }], 'blocks-text')).toMatchObject({
          success: false,
        });
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
      }
      for (const id of ['blocks-carousel', 'layout-card', 'constructor', '__proto__', 'toString']) {
        const result = checkFamilyBlock({ type: 'text', markdown: 'Hi' }, id);
        expect(result, id).toMatchObject({ success: false });
      }
    });
  });

  describe('blockFamilyMismatch hardening', () => {
    it('blockFamilyMismatch never reaches the prototype and tolerates unknown blocks-* ids', () => {
      for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
        expect(() => blockFamilyMismatch(id, { block: { type: 'text' } }), id).not.toThrow();
        expect(blockFamilyMismatch(id, { block: { type: 'text' } }), id).toBeNull();
      }
      expect(blockFamilyMismatch('blocks-carousel', { block: { type: 'text' } })).toContain(
        'no known block family'
      );
      // keeps a host catalog with such ids from stopping validation
      {
        const blockSpec = catalog.get('blocks-text');
        if (!blockSpec) throw new Error('blocks-text is missing from the catalog');
        const host: RenderCatalog = {
          get: (id) =>
            id === 'constructor' || id === 'blocks-carousel' ? blockSpec : catalog.get(id),
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
      }
    });
  });
});
