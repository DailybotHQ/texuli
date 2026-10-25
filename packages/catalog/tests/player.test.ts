// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeParseBlock } from '@texuli/blocks/core';
import { describe, expect, it, vi } from 'vitest';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { blueprintDigest } from '../src/edit/index.ts';
import { createEnvelope } from '../src/envelope/index.ts';
import {
  createPlayer,
  MAX_PENDING_INTENTS_PER_NODE,
  type PaintAdapter,
  type PaintUrlIssue,
  type PlayerLoader,
  paintProps,
} from '../src/player/index.ts';
import type { CatalogTreeInput } from '../src/render/renderer/index.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);

type Painted =
  | { id: string; props: Record<string, unknown>; children?: Painted[] }
  | { placeholder: string; reason: string }
  | { skeleton: string };

/** Paints into plain data: the shape the tree would mount as. */
const toData: PaintAdapter<Painted> = {
  component: (node, _component, children) => ({
    id: node.id,
    props: { ...node.props },
    ...(children.length > 0 ? { children: [...children] } : {}),
  }),
  placeholder: (node) => ({ placeholder: node.id, reason: node.reason }),
  skeleton: (node) => ({ skeleton: node.id }),
};

/** A loader for every catalog id, counting calls. */
function stubLoaders(): { loaders: Record<string, PlayerLoader>; calls: Map<string, number> } {
  const calls = new Map<string, number>();
  const loaders: Record<string, PlayerLoader> = {};
  for (const entry of build.catalog.entries) {
    loaders[entry.id] = async () => {
      calls.set(entry.id, (calls.get(entry.id) ?? 0) + 1);
      return { component: entry.id };
    };
  }
  return { loaders, calls };
}

const fixture = (name: string): { tier: 'untrusted'; tree: CatalogTreeInput } =>
  JSON.parse(readFileSync(join(import.meta.dirname, 'player-fixtures', `${name}.json`), 'utf8'));

const report = fixture('07-report-on-demand').tree;

describe('audit fixtures paint exactly', () => {
  it.each(['02-dashboard', '06-presentation-slide', '07-report-on-demand', '08-proactive-deck'])(
    '%s paints every node with its props, at the untrusted tier',
    async (name) => {
      const { tree, tier } = fixture(name);
      const { loaders } = stubLoaders();
      const player = createPlayer({
        blueprint: tree,
        catalog,
        loaders,
        checkBlock: safeParseBlock,
      });
      expect(tier).toBe('untrusted');
      expect(player.state.validation.diagnostics).toEqual([]);
      expect(player.state).toMatchObject({ status: 'draft', surface: 'tree', paintIssues: [] });
      const [painted] = await player.paint(toData);
      expect(painted).toEqual(tree);
      expect(player.receipt()).toMatchObject({ ok: true, tier: 'untrusted', errors: 0 });
    }
  );
});

describe('untrusted at paint', () => {
  it('re-checks URLs at any depth at paint time and removes what the policy refuses', () => {
    const props = {
      title: 'Links',
      href: 'javascript:alert(1)',
      block: { type: 'gallery', items: [{ src: 'images/a.webp' }, { src: 'ftp://x.example/b' }] },
      safe: { nested: { url: 'https://example.com/ok' } },
    };
    const issues: PaintUrlIssue[] = [];
    const out = paintProps(props, issues);
    expect(out).toEqual({
      title: 'Links',
      block: { type: 'gallery', items: [{ src: 'images/a.webp' }, {}] },
      safe: { nested: { url: 'https://example.com/ok' } },
    });
    expect(out.safe).toBe(props.safe);
    expect(props.href).toBe('javascript:alert(1)');
    expect(issues.map((i) => i.path)).toEqual(['props.href', 'props.block.items[1].src']);
  });

  it('polices every srcset candidate at paint, whatever the key case or depth', () => {
    const issues: PaintUrlIssue[] = [];
    const out = paintProps(
      {
        srcset: 'images/a-1x.webp 1x, images/a-2x.webp 2x',
        srcSet: 'images/a.webp 1x, javascript:alert(1) 2x',
        block: { type: 'image', imageSrcset: 'data:image/png;base64,AAAA 1x' },
        posterSrcset: 'https://example.com/p.webp 640w, //evil.example/p.webp 1280w',
      },
      issues
    );
    expect(out).toEqual({
      srcset: 'images/a-1x.webp 1x, images/a-2x.webp 2x',
      block: { type: 'image' },
    });
    expect(issues.map((i) => i.path)).toEqual([
      'props.srcSet',
      'props.block.imageSrcset',
      'props.posterSrcset',
    ]);
  });

  it('applies the untrusted policy at paint even when the developer tier validated the tree', () => {
    // A relative link is fine for app-authored props but not for untrusted paint.
    const tree = {
      id: 'layout-doc',
      props: { title: 'Guide' },
      children: [{ id: 'media-image', props: { src: 'images/a.webp', alt: 'A', href: '/docs' } }],
    };
    const player = createPlayer({
      blueprint: tree,
      catalog: renderCatalogFromBuild(build.catalog, { developer: 'all' }),
      tier: 'developer',
    });
    const image =
      player.state.plan[0]?.kind === 'component' ? player.state.plan[0].children[0] : null;
    expect(image).toMatchObject({ kind: 'component', props: { src: 'images/a.webp', alt: 'A' } });
    expect(image?.kind === 'component' && 'href' in image.props).toBe(false);
    expect(player.state.paintIssues.map((i) => i.path)).toEqual(['0.children.0.props.href']);
  });
});

describe('lazy loaders and per-node failures', () => {
  it('loads each used id once, and only the ids the tree uses', async () => {
    const { loaders, calls } = stubLoaders();
    await createPlayer({ blueprint: report, catalog, loaders }).paint(toData);
    const used = new Set<string>();
    const walk = (node: CatalogTreeInput) => {
      used.add(node.id);
      node.children?.forEach(walk);
    };
    walk(report);
    expect([...calls.keys()].sort()).toEqual([...used].sort());
    expect(Math.max(...calls.values())).toBe(1);
    expect(calls.has('dialog')).toBe(false);
  });

  it('paints skeletons first, then the components once loads settle', async () => {
    const { loaders } = stubLoaders();
    const player = createPlayer({ blueprint: report, catalog, loaders });
    const settled = vi.fn();
    player.subscribe(settled);
    const first = player.paintNow(toData);
    expect(first).toEqual([{ skeleton: 'layout-doc' }]);
    await vi.waitFor(() => expect(settled).toHaveBeenCalled());
    await player.paint(toData);
    expect(player.paintNow(toData)[0]).toEqual(report);
  });

  it('turns a node whose loader fails, or whose mount throws, into a placeholder; siblings paint', async () => {
    const { loaders } = stubLoaders();
    const tree = {
      id: 'layout-doc',
      props: { title: 'Mixed' },
      children: [
        { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Fine.' } } },
        { id: 'charts-gauge', props: { label: 'Load', value: 3 } },
        { id: 'charts-sparkline', props: { label: 'Trend', values: [1, 2] } },
      ],
    };
    const player = createPlayer({
      blueprint: tree,
      catalog,
      loaders: { ...loaders, 'charts-gauge': () => Promise.reject(new Error('chunk failed')) },
    });
    const throwing: PaintAdapter<Painted> = {
      ...toData,
      component: (node, component, children) => {
        if (node.id === 'charts-sparkline') throw new Error('bad props');
        return toData.component(node, component, children);
      },
    };
    const [doc] = await player.paint(throwing);
    expect(doc).toMatchObject({
      id: 'layout-doc',
      children: [
        { id: 'blocks-text' },
        { placeholder: 'charts-gauge', reason: 'node-error' },
        { placeholder: 'charts-sparkline', reason: 'node-error' },
      ],
    });
  });

  it('plans a placeholder for an id the host has no loader for', async () => {
    const player = createPlayer({
      blueprint: report,
      catalog,
      loaders: { 'layout-doc': async () => 'doc' },
    });
    const [doc] = await player.paint(toData);
    expect(doc && 'children' in doc && doc.children?.every((c) => 'placeholder' in c)).toBe(true);
  });
});

describe('invalid drafts and status', () => {
  it('refuses an invalid draft by default: a notice, no tree, status invalid', async () => {
    const bad = { ...report, children: [{ id: 'dialog', props: {} }] };
    const player = createPlayer({ blueprint: bad, catalog, status: 'active' });
    expect(player.state).toMatchObject({
      status: 'invalid',
      surface: 'notice',
      error: 'invalid',
      plan: [],
    });
    expect(await player.paint(toData)).toEqual([]);
    expect(await player.digest()).toBeNull();
  });

  it('previews an invalid draft with visible placeholders when the host asks', () => {
    const bad = { ...report, children: [{ id: 'dialog', props: {} }] };
    const player = createPlayer({ blueprint: bad, catalog, invalidPolicy: 'preview' });
    expect(player.state.surface).toBe('tree');
    expect(player.state.plan[0]).toMatchObject({
      children: [{ kind: 'placeholder', id: 'dialog', reason: 'tier-denied' }],
    });
  });

  it('names parse, over-limits and catalog-mismatch errors', () => {
    expect(createPlayer({ blueprint: '{', catalog }).state.error).toBe('parse');
    let deep: CatalogTreeInput = { id: 'layout-card' };
    for (let i = 0; i < 20; i += 1) deep = { id: 'layout-card', children: [deep] };
    expect(createPlayer({ blueprint: { ...report, children: [deep] }, catalog }).state.error).toBe(
      'over-limits'
    );
    const envelope = createEnvelope({
      id: 'r1',
      catalog: 'c'.repeat(64),
      generator: { kind: 'agent', name: 'Harbor assistant' },
      tree: report,
    });
    expect(
      createPlayer({ blueprint: envelope, catalog, catalogHash: build.hash }).state.error
    ).toBe('catalog-mismatch');
  });

  it('reads an envelope but takes the status from the host, never from the blueprint', () => {
    const forged = {
      ...createEnvelope({
        id: 'report-week-42',
        catalog: build.hash,
        generator: { kind: 'agent', name: 'Harbor assistant' },
        tree: report,
      }),
      status: 'active',
    };
    const player = createPlayer({ blueprint: forged, catalog, catalogHash: build.hash });
    expect(player.state.status).toBe('draft');
    expect(player.receipt()).toMatchObject({
      ok: true,
      envelopeId: 'report-week-42',
      catalogHash: build.hash,
      warnings: 1,
    });
    player.update({ status: 'active' });
    expect(player.state.status).toBe('active');
  });
});

describe('handle: digest, receipt, no activate', () => {
  it('digests the validated tree and has no activate method', async () => {
    const player = createPlayer({ blueprint: JSON.stringify(report), catalog });
    expect(await player.digest()).toBe(await blueprintDigest(report));
    expect('activate' in player).toBe(false);
    expect(player.receipt().checks.blocks).toBe('skipped');
  });
});

describe('closed intents', () => {
  const player = () => createPlayer({ blueprint: report, catalog });

  it('queues intents from the closed set for the host, never performing them', () => {
    const p = player();
    const nav = p.propose('0', { kind: 'navigate', href: 'https://example.com/report' });
    expect(nav).toMatchObject({
      ok: true,
      intent: { id: 'intent-1', componentId: 'layout-doc', status: 'pending' },
    });
    expect(p.propose('0', { kind: 'export', format: 'pdf' }).ok).toBe(true);
    expect(p.propose('0', { kind: 'request-fullscreen' }).ok).toBe(true);
    expect(p.confirm('intent-1')).toBe(true);
    expect(p.confirm('intent-1')).toBe(false);
    expect(p.reject('intent-2')).toBe(true);
    expect(p.intents().map((i) => i.status)).toEqual(['confirmed', 'rejected', 'pending']);
  });

  it('refuses unsafe links, unknown kinds, extra fields, missing nodes and floods', () => {
    const p = player();
    expect(p.propose('0', { kind: 'navigate', href: 'javascript:alert(1)' }).ok).toBe(false);
    expect(p.propose('0', { kind: 'activate' }).ok).toBe(false);
    expect(p.propose('0', { kind: 'copy', text: 'x', after: 'send' }).ok).toBe(false);
    expect(p.propose('0', { kind: 'export', format: 'exe' }).ok).toBe(false);
    expect(p.propose('9', { kind: 'request-fullscreen' }).ok).toBe(false);
    for (let i = 0; i < MAX_PENDING_INTENTS_PER_NODE; i += 1) {
      expect(p.propose('0', { kind: 'copy', text: `line ${i}` }).ok).toBe(true);
    }
    expect(p.propose('0', { kind: 'copy', text: 'one more' }).ok).toBe(false);
  });

  it('drops intents when the blueprint changes, and an invalid draft proposes nothing', () => {
    const p = player();
    p.propose('0', { kind: 'request-fullscreen' });
    p.update({ blueprint: { ...report, children: [{ id: 'dialog' }] } });
    expect(p.intents()).toEqual([]);
    expect(p.propose('0', { kind: 'request-fullscreen' }).ok).toBe(false);
  });

  it('does nothing after dispose', async () => {
    const p = player();
    p.dispose();
    expect(await p.paint(toData)).toEqual([]);
    expect(p.propose('0', { kind: 'request-fullscreen' }).ok).toBe(false);
  });
});

describe('paint-time hardening (found by the hostile fuzz rounds)', () => {
  it('drops handler, forbidden and prototype keys at any depth', () => {
    const block = JSON.parse(
      '{"type":"text","markdown":"Hi","onload":"alert(1)","nested":{"onClick":"go()","style":"x"},"__proto__":{"href":"javascript:alert(1)"},"href":"javascript:alert(2)"}'
    );
    const issues: PaintUrlIssue[] = [];
    const out = paintProps({ block }, issues) as { block: Record<string, unknown> };
    expect(out.block).toEqual({ type: 'text', markdown: 'Hi', nested: {} });
    // The copy never gains a prototype from the payload's own "__proto__" key.
    expect(Object.getPrototypeOf(out.block)).toBe(Object.prototype);
    expect((out.block as { href?: unknown }).href).toBeUndefined();
    expect(issues.map((i) => i.path).sort()).toEqual([
      'props.block.__proto__',
      'props.block.href',
      'props.block.nested.onClick',
      'props.block.nested.style',
      'props.block.onload',
    ]);
  });

  it('drops values nested too deep to police instead of passing them through', () => {
    let deep: unknown = { href: 'javascript:alert(1)' };
    for (let i = 0; i < 40; i += 1) deep = { child: deep };
    const issues: PaintUrlIssue[] = [];
    const out = paintProps({ data: deep }, issues);
    expect(JSON.stringify(out)).not.toContain('javascript:');
    expect(issues.some((i) => i.message.includes('too deep'))).toBe(true);
  });
});
