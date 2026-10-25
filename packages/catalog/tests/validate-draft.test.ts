// @vitest-environment node
import { safeParseBlock } from '@texuli/blocks/core';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { createEditHistory } from '../src/edit/index.ts';
import { grammarRolesFromList } from '../src/render/grammar/index.ts';
import type { CatalogTreeInput } from '../src/render/renderer/index.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import {
  DRAFT_CHECKS,
  type DraftValidation,
  draftCommitGate,
  scanSinks,
  validateDraft,
} from '../src/validate/index.ts';

const build = await buildCatalog(await discoverManifestGroups());
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
  it('passes every check it runs and returns the render tree and a clean draft', () => {
    const result = validateDraft(VALID, { catalog, checkBlock: safeParseBlock });
    expect(result.diagnostics).toEqual([]);
    expect(result).toMatchObject({ ok: true, status: 'valid', tier: 'untrusted' });
    expect(result.checks).toEqual(
      Object.fromEntries(DRAFT_CHECKS.map((c) => [c, c === 'envelope' ? 'skipped' : 'pass']))
    );
    expect(result.envelope).toBeNull();
    expect(result.roots[0]).toMatchObject({ kind: 'component', id: 'layout-doc' });
    expect(result.draft).toEqual(VALID);
  });

  it('reads JSON text, and marks the block schema skipped when the host gives none', () => {
    const result = validateDraft(JSON.stringify(VALID, null, 2), { catalog });
    expect(result.ok).toBe(true);
    expect(result.checks.blocks).toBe('skipped');
    expect(result.checks.input).toBe('pass');
  });

  it('accepts fragments and arrays when the host turns the root rule off', () => {
    expect(validateDraft(paragraph('Hi'), { catalog }).ok).toBe(false);
    const fragment = validateDraft([paragraph('One'), paragraph('Two')], {
      catalog,
      frameRoots: false,
    });
    expect(fragment.ok).toBe(true);
    expect(fragment.checks.root).toBe('skipped');
  });
});

describe('validateDraft: input', () => {
  it('refuses oversized text before parsing, bad JSON and non-trees', () => {
    const big = validateDraft(' '.repeat(300 * 1024), { catalog });
    expect(big).toMatchObject({ ok: false, status: 'parse', draft: null });
    expect(codes(big)).toEqual(['input:too-large']);
    expect(codes(validateDraft('{"id": ', { catalog }))).toEqual(['input:bad-json']);
    for (const value of ['"text"', '42', 'null', 7, null, undefined]) {
      const result = validateDraft(value, { catalog });
      expect(result.status, String(value)).toBe('parse');
      expect(codes(result)).toEqual(['input:not-a-tree']);
    }
  });

  it('respects a tighter text cap', () => {
    const result = validateDraft(JSON.stringify(VALID), { catalog, maxTextBytes: 64 });
    expect(codes(result)).toEqual(['input:too-large']);
  });
});

describe('validateDraft: hostile structure', () => {
  it('reports unknown node fields and strips them from the draft', () => {
    const result = validateDraft({ ...VALID, script: 'x', meta: { a: 1 } }, { catalog });
    expect(result.ok).toBe(false);
    expect(codes(result)).toEqual(['structure:unknown-field', 'structure:unknown-field']);
    expect(result.draft).toEqual(VALID);
  });

  it('reports prototype keys anywhere, in parsed JSON and in objects', () => {
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
  });

  it('refuses a depth bomb in props or in a bare array without overflowing the stack', () => {
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
  });

  it('refuses a deep node tree through the limits', () => {
    let cursor: CatalogTreeInput = { id: 'layout-card', props: {} };
    for (let i = 0; i < 20; i += 1) cursor = { id: 'layout-card', props: {}, children: [cursor] };
    const result = validateDraft(doc(cursor), { catalog });
    expect(result).toMatchObject({ ok: false, status: 'over-limits', draft: null });
    expect(codes(result)).toContain('limits:depth-exceeded');
  });

  it('fails closed instead of throwing on an object that throws', () => {
    const trap = {
      get id(): string {
        throw new Error('boom');
      },
    };
    const result = validateDraft(trap, { catalog });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('input:internal-error');
  });
});

describe('validateDraft: sinks, renderer, blocks, grammar and root', () => {
  it('reports raw sinks the renderer would have cleaned', () => {
    const result = validateDraft(
      doc(paragraph('[Open](javascript:alert(1))'), {
        id: 'charts-funnel',
        props: { title: 'Funnel', steps: [{ id: 'a', label: 'javascript:alert(1)', value: 1 }] },
      }),
      { catalog }
    );
    const sinks = result.diagnostics.filter((d) => d.check === 'sinks');
    expect(sinks.map((d) => d.path)).toEqual([
      'tree.children[0].props.block.markdown',
      'tree.children[1].props.steps[0].label',
    ]);
    expect(result.checks.sinks).toBe('fail');
  });

  it('runs the renderer at the host tier: the developer tier is the emittable ids (D5)', () => {
    const tree = doc({ id: 'dialog', props: { title: 'Hi' } });
    expect(codes(validateDraft(tree, { catalog }))).toContain('render:tier-denied');
    const developer = validateDraft(tree, { catalog, tier: 'developer' });
    expect(developer.tier).toBe('developer');
    expect(codes(developer)).toContain('render:tier-denied');
    const chrome = renderCatalogFromBuild(build.catalog, { developer: 'all' });
    const trusted = validateDraft(tree, { catalog: chrome, tier: 'developer' });
    expect(codes(trusted)).not.toContain('render:tier-denied');
  });

  it('reports a block of another family, and deep block schemas through the host check', () => {
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
  });

  it('fails on grammar errors and keeps warnings informational', () => {
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
  });

  it('requires one frame root by default', () => {
    expect(codes(validateDraft(paragraph('Bare'), { catalog }))).toEqual(['root:frame-root']);
    expect(codes(validateDraft([VALID, VALID], { catalog }))).toContain('root:root-count');
    expect(codes(validateDraft(VALID, { catalog, frameRoots: ['layout-page'] }))).toEqual([
      'root:frame-root',
    ]);
  });
});

describe('scanSinks', () => {
  it('finds forbidden keys, handlers, HTML, bidi controls and refused URLs at any depth', () => {
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
    expect(history.apply({ op: 'insert', parent: [], index: 2, node: paragraph('More') }).ok).toBe(
      true
    );
  });
});
