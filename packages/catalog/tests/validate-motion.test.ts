// @vitest-environment node
import { readFileSync } from 'node:fs';
import { SPEC_VERSION } from '@texuli/spec';
import { SPEC_MOTION_LEVELS, SPEC_MOTION_PRESETS } from '@texuli/spec/motion';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/index.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { parseEnvelope } from '../src/envelope/index.ts';
import { createPlayer, type PaintNode } from '../src/player/index.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import type { RenderNode } from '../src/render/renderer/types.ts';
import { validateDraft } from '../src/validate/index.ts';

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);

const run = (input: unknown) => validateDraft(input, { catalog, frameRoots: false });
const errors = (result: ReturnType<typeof run>) =>
  result.diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.check}:${d.code}`);

function envelope(tree: unknown, extra: Record<string, unknown> = {}) {
  return {
    format: 'texuli-blueprint',
    version: 1,
    id: 'motion-test',
    catalog: build.hash,
    status: 'draft',
    createdAt: '2026-10-28T09:00:00Z',
    updatedAt: '2026-10-28T09:00:00Z',
    generator: { kind: 'agent', name: 'Fictional agent' },
    spec: '0.6.0',
    ...extra,
    tree,
  };
}

const card = (motion?: unknown) => ({
  id: 'layout-card',
  props: { title: 'Pipeline' },
  ...(motion === undefined ? {} : { motion }),
  children: [{ id: 'blocks-text', props: { block: { type: 'text', markdown: 'Shipped.' } } }],
});

const first = (roots: readonly RenderNode[]) =>
  roots[0] as Extract<RenderNode, { kind: 'component' }>;

describe('spec 0.6.0 motion in the catalog', () => {
  it('accepts the closed vocabulary and carries a frozen copy to the render tree', () => {
    for (const enter of SPEC_MOTION_PRESETS) {
      const motion = { enter, exit: 'fade', layout: true, stagger: 'fast', duration: 'slow' };
      const result = run(card(motion));
      expect(errors(result), enter).toEqual([]);
      const root = first(result.roots);
      expect(root.motion).toEqual(motion);
      expect(Object.isFrozen(root.motion)).toBe(true);
      // The normalized draft keeps it, so the digest covers motion.
      expect((result.draft as { motion?: unknown }).motion).toEqual(motion);
    }
    // No motion stays no motion.
    expect(first(run(card()).roots).motion).toBeUndefined();
  });

  it('refuses raw CSS, durations, keyframes, unknown names and a huge stagger, and paints without motion', () => {
    const hostile: [string, unknown][] = [
      ['raw css', { enter: 'fade', css: 'transition: all 9s linear' }],
      ['style', { style: 'animation: spin 1s infinite' }],
      ['keyframes', { enter: [{ opacity: 0 }, { opacity: 1 }] }],
      ['easing', { easing: 'cubic-bezier(0, 0, 1, 1)' }],
      ['ms duration', { enter: 'rise', duration: '350ms' }],
      ['number duration', { duration: 350 }],
      ['unknown preset', { enter: 'spin' }],
      ['css preset', { exit: 'opacity 0.2s' }],
      ['huge stagger', { stagger: 100000 }],
      ['stagger ms', { stagger: '9999ms' }],
      ['layout text', { layout: 'yes' }],
      ['string', 'fade'],
      ['array', ['fade']],
      ['null', null],
      ['script', { enter: '<script>alert(1)</script>' }],
    ];
    for (const [name, motion] of hostile) {
      const result = run(card(motion));
      expect(result.ok, name).toBe(false);
      expect(errors(result), name).toContain('render:invalid-motion');
      const root = first(result.roots);
      // The node still paints; only its motion is dropped.
      expect(root?.id, name).toBe('layout-card');
      expect(root?.motion, name).toBeUndefined();
      const message = result.diagnostics.find((d) => d.code === 'invalid-motion')?.message ?? '';
      expect(message.length, name).toBeLessThan(300);
    }
  });

  it('checks the envelope motion level', () => {
    for (const level of SPEC_MOTION_LEVELS) {
      const result = run(envelope(card(), { motion: { level } }));
      expect(errors(result), level).toEqual([]);
      expect(result.envelope?.motion).toEqual({ level });
    }
    for (const motion of [{ level: 'max' }, { level: 'full', ms: 9000 }, 'full', {}, null]) {
      const result = run(envelope(card(), { motion }));
      expect(errors(result), JSON.stringify(motion)).toContain('envelope:invalid-motion');
      expect(result.ok).toBe(false);
    }
    const parsed = parseEnvelope(envelope(card(), { motion: { level: 'none' } }));
    expect(parsed.issues).toEqual([]);
  });

  it('migrates a 0.5.0 envelope before checking, and takes motion only where the spec allows', () => {
    const migrated = run(envelope(card({ enter: 'fade' }), { spec: '0.5.0' }));
    expect(errors(migrated)).toEqual([]);
    expect(migrated.envelope?.spec).toBe(SPEC_VERSION);
    // A motion-like field outside `motion` is still an unknown node field.
    const stray = run({ ...card(), animation: 'fade' });
    expect(errors(stray)).toContain('structure:unknown-field');
  });

  it('validates the motion golden and hands the motion to the paint plan', () => {
    const golden = JSON.parse(
      readFileSync(
        new URL('../../spec/fixtures/golden/app-dashboard.json', import.meta.url),
        'utf8'
      )
    ) as Record<string, unknown>;
    const loaders = Object.fromEntries(
      build.catalog.entries.map((entry) => [entry.id, () => Promise.resolve(() => null)])
    );
    const player = createPlayer({
      blueprint: golden,
      catalog,
      loaders,
      checkBlock: () => ({ success: true }),
    });
    const plan = player.state.plan;
    const withMotion: PaintNode[] = [];
    const walk = (nodes: readonly PaintNode[]) => {
      for (const node of nodes) {
        if (node.kind !== 'component') continue;
        if (node.motion) withMotion.push(node);
        walk(node.children);
      }
    };
    walk(plan);
    expect(player.state.validation.envelope?.motion).toEqual({ level: 'full' });
    expect(
      withMotion.map((node) => [node.path, node.kind === 'component' ? node.motion : null])
    ).toEqual([
      ['0.children.1', { enter: 'fade', duration: 'fast' }],
      ['0.children.2', { stagger: 'fast' }],
      ['0.children.2.children.0', { enter: 'rise' }],
      ['0.children.2.children.1', { enter: 'rise' }],
      ['0.children.2.children.2', { enter: 'rise' }],
      ['0.children.2.children.3', { enter: 'rise' }],
      ['0.children.3', { enter: 'rise', layout: true }],
    ]);
  });

  it('checks a wide hostile motion object in linear time', () => {
    const wide = Object.fromEntries(Array.from({ length: 2_000 }, (_, i) => [`k${i}`, 'fade']));
    const started = performance.now();
    const result = run(card(wide));
    expect(errors(result)).toContain('render:invalid-motion');
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
