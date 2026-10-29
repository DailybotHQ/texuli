// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formulaConditions } from '@texuli/catalog/render/conditions';
import { type DraftDiagnostic, validateDraft } from '@texuli/catalog/validate';
import { createBlueprintStream } from '@texuli/spec/stream';
import { describe, expect, it } from 'vitest';
import { checkFamilyBlock } from '../src/block-check.ts';
import { createPlayerCatalog } from '../src/catalog.ts';
import { withoutHostChrome } from '../src/host-chrome.ts';
import { PLAYER_GRAMMAR_ROLES } from '../src/layout-manifests.ts';
import { splitStatefulBlueprint } from '../src/state/bind.ts';
import { playerResolveOptions, resolveSplitBlueprint } from '../src/state/resolve.ts';
import { initialSnapshot } from '../src/state/schema.ts';
import {
  createStreamSession,
  pumpStream,
  STREAM_PENDING_ID,
  type StreamSnapshot,
} from '../src/stream/session.ts';
import { checkDocument } from './document-host.ts';

/**
 * The player's streaming session (ADR-014): every golden streams clean in
 * any chunking and paints progressively; nothing `validateDraft` refuses at
 * a node is ever painted while streaming; interruption at any offset keeps
 * only admitted nodes; the partial draft never trips the player's state
 * rules.
 */

const SPEC = join(import.meta.dirname, '../../spec/fixtures');
const read = (path: string): string => readFileSync(path, 'utf8');
const goldens = readdirSync(join(SPEC, 'golden'))
  .filter((file) => file.endsWith('.json'))
  .sort();
const invalids = readdirSync(join(SPEC, 'invalid'))
  .filter((file) => file.endsWith('.json'))
  .sort();

const catalog = createPlayerCatalog();
const validate = {
  catalog: withoutHostChrome(catalog),
  tier: 'untrusted' as const,
  checkBlock: checkFamilyBlock,
  checkDocument,
  conditions: formulaConditions,
  conditionInputs: {},
  roles: PLAYER_GRAMMAR_ROLES,
};
const session = () =>
  createStreamSession({ validate, bindable: (id) => catalog.get(id)?.bindable });

/** A seeded generator, so random chunkings replay. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function chunks(text: string, seed: number, max = 64): string[] {
  const next = random(seed);
  const out: string[] = [];
  for (let i = 0; i < text.length; ) {
    const size = 1 + Math.floor(next() * max);
    out.push(text.slice(i, i + size));
    i += size;
  }
  return out;
}

type Node = { id: string; children?: Node[] } & Record<string, unknown>;
const treeOf = (value: unknown): Node | Node[] => {
  const record = value as Record<string, unknown>;
  return (record.tree ?? record.blueprint ?? record) as Node | Node[];
};

/** Every node path of a tree with its node. */
function nodes(value: unknown): Map<string, Node> {
  const out = new Map<string, Node>();
  const visit = (node: Node, path: string) => {
    out.set(path, node);
    node.children?.forEach((child, index) => {
      visit(child, `${path}.children.${index}`);
    });
  };
  const tree = treeOf(value);
  if (Array.isArray(tree)) for (const [index, node] of tree.entries()) visit(node, String(index));
  else visit(tree, '0');
  return out;
}

/** The admitted node paths of a snapshot's partial tree (markers excluded). */
function paintedPaths(snapshot: StreamSnapshot): Set<string> {
  const out = new Set<string>();
  if (snapshot.phase === 'complete') return out;
  for (const [path, node] of nodes(snapshot.blueprint)) {
    if (node.id !== STREAM_PENDING_ID) out.add(path);
  }
  return out;
}

/** Stream `text` in `parts`, collecting a snapshot after every chunk. */
function stream(parts: readonly string[], end = true) {
  const s = session();
  const snapshots: StreamSnapshot[] = [];
  for (const part of parts) {
    s.write(part);
    snapshots.push(s.snapshot());
  }
  if (end) s.end();
  return { session: s, snapshots, last: s.snapshot() };
}

/** A diagnostic path, as a node path (`0.children.1`), or `null` when it names no node. */
function nodePathOf(path: string): string | null {
  if (path === '' || path === '$') return null;
  if (path.startsWith('$')) {
    const tree = /^\$\.(?:tree|blueprint)((?:\[\d+\]|\.children\[\d+\])*)/.exec(path);
    if (!tree) return null;
    const rest = (tree[1] ?? '').replace(/\.children\[(\d+)\]/g, '.children.$1');
    return rest.startsWith('[') ? rest.replace(/^\[(\d+)\]/, '$1') : `0${rest}`;
  }
  return /^\d+(?:\.children\.\d+)*/.exec(path)?.[0] ?? null;
}

describe('streaming session: goldens', () => {
  for (const file of goldens) {
    const text = read(join(SPEC, 'golden', file));
    const expected = JSON.parse(text);
    const all = nodes(expected);

    it(`${file}: any chunking paints every node and hands over the same value`, () => {
      for (const parts of [[text], chunks(text, 1, 3), chunks(text, 7, 97), chunks(text, 42)]) {
        const { snapshots, last } = stream(parts);
        expect(last.phase).toBe('complete');
        expect(last.blueprint).toEqual(expected);
        expect(last.issues).toEqual([]);
        // Before the end, every node was admitted: no false refusal.
        const before = snapshots[snapshots.length - 1] as StreamSnapshot;
        expect(before.painted).toBe(all.size);
        expect(before.held).toBe(0);
        expect(before.pending.size).toBe(0);
        // Painting only grows, and the partial draft never trips the player's state rules.
        let painted = 0;
        for (const snapshot of snapshots) {
          expect(snapshot.painted).toBeGreaterThanOrEqual(painted);
          painted = snapshot.painted;
          const split = splitStatefulBlueprint(snapshot.blueprint);
          const values = split.kind === 'stateful' ? initialSnapshot(split.declarations) : {};
          const resolved = resolveSplitBlueprint(
            split,
            values,
            playerResolveOptions(split, (id) => catalog.get(id)?.bindable)
          );
          expect(resolved.issues).toEqual([]);
          // Admitted shells are exactly what the agent wrote.
          for (const path of paintedPaths(snapshot)) {
            const { children: _a, ...shell } = all.get(path) as Node;
            const { children: _b, ...painted } = nodes(snapshot.blueprint).get(path) as Node;
            expect(painted).toEqual(shell);
          }
        }
      }
    });
  }

  it('paints progressively: the first nodes show long before the end', () => {
    const text = read(join(SPEC, 'golden', 'report-on-demand.json'));
    const half = stream([text.slice(0, Math.floor(text.length / 2))], false).last;
    expect(half.phase).toBe('streaming');
    expect(half.painted).toBeGreaterThan(2);
    // The node still arriving is a pending marker at its own path.
    expect([...half.pending.values()].some((node) => node.state === 'pending')).toBe(true);
  });
});

describe('streaming session: refusals', () => {
  const NODE_CHECKS = new Set([
    'structure',
    'interaction',
    'sinks',
    'render',
    'blocks',
    'documents',
    'limits',
  ]);
  const hostile: Record<string, unknown> = {
    'javascript-link': {
      id: 'layout-page',
      props: { title: 'Fictional' },
      children: [
        { id: 'link', props: { href: 'javascript:alert(1)', label: 'Open' } },
        { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Fine.' } } },
      ],
    },
    'unknown-id-mid-tree': {
      id: 'layout-page',
      props: { title: 'Fictional' },
      children: [
        { id: 'blocks-text', props: { block: { type: 'text', markdown: 'First.' } } },
        { id: 'not-a-component', props: {} },
        { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Third.' } } },
      ],
    },
    'html-sink': {
      id: 'layout-page',
      props: { title: 'Fictional' },
      children: [
        { id: 'blocks-text', props: { block: { type: 'text', markdown: '<script>x</script>' } } },
      ],
    },
    'extra-node-field': {
      id: 'layout-page',
      props: { title: 'Fictional' },
      children: [{ id: 'badge', props: { label: 'New' }, style: 'color:red' }],
    },
  };
  const cases: [string, string][] = [
    ...invalids.map((file): [string, string] => {
      const fixture = JSON.parse(read(join(SPEC, 'invalid', file))) as { blueprint: unknown };
      return [file, JSON.stringify(fixture.blueprint, null, 2)];
    }),
    ...Object.entries(hostile).map(([name, value]): [string, string] => [
      name,
      JSON.stringify(value, null, 2),
    ]),
  ];

  it('every validateDraft refusal is a refusal or a not-yet-painted node while streaming', () => {
    let refused = 0;
    for (const [name, text] of cases) {
      const verdict = validateDraft(JSON.parse(text), validate);
      // The final verdict is the same validateDraft: the stream cannot change it.
      const { snapshots, last } = stream(chunks(text, name.length, 24));
      if (verdict.ok) continue;
      refused += 1;
      expect(last.phase, name).toBe('complete');
      expect(validateDraft(last.blueprint, validate).ok, name).toBe(false);
      // Every node a node-level check refused is never painted. The one exception is
      // the canonical order: a shell final at `children` may paint, and a member
      // that arrives after `children` (what the check refused) holds it again.
      const blamed = verdict.diagnostics
        .filter((d: DraftDiagnostic) => d.severity === 'error' && NODE_CHECKS.has(d.check))
        .map((d) => nodePathOf(d.path))
        .filter((path): path is string => path !== null);
      const final = snapshots[snapshots.length - 1] as StreamSnapshot;
      const outOfOrder = (path: string) =>
        final.issues.some(
          (issue) =>
            issue.code === 'stream-order' &&
            (path === issue.path || path.startsWith(`${issue.path}.`))
        );
      for (const path of blamed) {
        expect(paintedPaths(final).has(path), `${name} painted ${path}`).toBe(false);
        if (outOfOrder(path)) continue;
        for (const snapshot of snapshots) {
          expect(paintedPaths(snapshot).has(path), `${name} painted ${path}`).toBe(false);
        }
      }
      // A refusal of the header (envelope, spec) paints no node at all; a header
      // member after the tree holds every node painted before it.
      if (verdict.diagnostics.some((d) => d.check === 'envelope' && d.severity === 'error')) {
        expect(final.painted, name).toBe(0);
        if (!outOfOrder('$')) {
          for (const snapshot of snapshots) expect(snapshot.painted, name).toBe(0);
        }
      }
    }
    expect(refused).toBeGreaterThan(20);
  });

  it('holds a node with a member after children, and its whole subtree', () => {
    const text = JSON.stringify({
      id: 'layout-page',
      props: { title: 'Fictional' },
      children: [
        {
          id: 'layout-stack',
          children: [{ id: 'blocks-text', props: { block: { type: 'text', markdown: 'A.' } } }],
          props: { gap: 'small' },
        },
      ],
    });
    const { last, snapshots } = stream([text], false);
    expect(snapshots[0]?.issues.map((issue) => issue.code)).toContain('stream-order');
    expect(last.pending.get('0.children.0')?.state).toBe('held');
    expect(paintedPaths(last).has('0.children.0.children.0')).toBe(false);
  });

  it('refuses a sibling that breaks a rule between siblings (one field name per form)', () => {
    const field = (name: string) => ({
      id: 'form-field',
      props: { label: 'Email', name, state: 'email' },
    });
    const text = JSON.stringify({
      format: 'texuli-local-state',
      version: 1,
      state: { email: { type: 'string', maxLength: 80 } },
      blueprint: {
        id: 'layout-page',
        props: { title: 'Fictional' },
        children: [
          {
            id: 'action-form',
            props: { action: 'request-access', label: 'Request access' },
            children: [field('email'), field('email')],
          },
        ],
      },
    });
    const { snapshots } = stream([text], false);
    const last = snapshots[0] as StreamSnapshot;
    expect(paintedPaths(last).has('0.children.0.children.0')).toBe(true);
    expect(paintedPaths(last).has('0.children.0.children.1')).toBe(false);
    expect(last.issues.some((issue) => issue.path === '0.children.0.children.1')).toBe(true);
  });
});

describe('streaming session: interruption', () => {
  const text = read(join(SPEC, 'golden', 'lego.json'));
  const all = nodes(JSON.parse(text));

  it('stops at any offset keeping only admitted, unchanged nodes', () => {
    for (let offset = 0; offset < text.length; offset += 53) {
      const s = session();
      s.write(text.slice(0, offset));
      s.abort('connection');
      const snapshot = s.snapshot();
      expect(snapshot.phase).toBe('interrupted');
      expect(snapshot.error?.code).toBe('connection');
      for (const path of paintedPaths(snapshot)) {
        const { children: _a, ...shell } = all.get(path) as Node;
        const { children: _b, ...painted } = nodes(snapshot.blueprint).get(path) as Node;
        expect(painted).toEqual(shell);
      }
      for (const node of snapshot.pending.values()) expect(node.state).not.toBe('pending');
      // Nothing more is read after a stop.
      s.write(text.slice(offset));
      s.end();
      expect(s.snapshot().phase).toBe('interrupted');
    }
  });

  it('a truncated stream ends as interrupted, never complete', () => {
    const s = session();
    s.write(text.slice(0, text.lastIndexOf('}')));
    s.end();
    expect(s.snapshot().phase).toBe('interrupted');
    expect(s.snapshot().error?.code).toBe('truncated');
  });

  it('pumps a source, decodes bytes across chunks and maps an abort', async () => {
    const encoded = new TextEncoder().encode(text);
    const bytes = async function* () {
      for (let i = 0; i < encoded.length; i += 7) yield encoded.slice(i, i + 7);
    };
    const s = session();
    await new Promise<void>((resolve) => {
      pumpStream(bytes(), s, () => {
        if (s.phase !== 'streaming') resolve();
      });
    });
    expect(s.snapshot().phase).toBe('complete');
    expect(s.snapshot().blueprint).toEqual(JSON.parse(text));

    const handle = createBlueprintStream();
    const aborted = session();
    const done = new Promise<void>((resolve) => {
      pumpStream(handle, aborted, () => {
        if (aborted.phase !== 'streaming') resolve();
      });
    });
    handle.write(text.slice(0, 6000));
    handle.abort('The fictional agent stopped.');
    await done;
    expect(aborted.snapshot().error).toMatchObject({
      code: 'aborted',
      message: 'The fictional agent stopped.',
    });
    expect(aborted.snapshot().painted).toBeGreaterThan(0);
  });
});
