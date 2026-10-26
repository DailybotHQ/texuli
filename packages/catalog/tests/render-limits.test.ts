// @vitest-environment node
import { Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TREE_LIMITS,
  measureCatalogTree,
  renderCatalogTreeWithLimits,
  utf8ByteLength,
  validateCatalogTreeLimits,
} from '../src/render/limits/index.ts';
import { type RenderComponentSpec, renderCatalogFromSpecs } from '../src/render/renderer/index.ts';

const card: RenderComponentSpec = {
  id: 'card',
  label: 'Card',
  agentEmittable: true,
  emit: ['developer', 'untrusted'],
  props: [
    { name: 'title', kind: 'string' },
    {
      name: 'variant',
      kind: 'enum',
      enumValues: ['elevated', 'flat'],
      default: 'elevated',
    },
  ],
};

const catalog = renderCatalogFromSpecs([card]);

function chain(depth: number): Record<string, unknown> {
  let node: Record<string, unknown> = { id: 'card', props: { title: `d${depth}` } };
  for (let d = depth - 1; d >= 1; d -= 1) {
    node = { id: 'card', props: { title: `d${d}` }, children: [node] };
  }
  return node;
}

function wide(count: number): Record<string, unknown> {
  return {
    id: 'card',
    props: { title: 'wide' },
    children: Array.from({ length: count }, (_, i) => ({
      id: 'card',
      props: { title: `c${i}` },
    })),
  };
}

/** A props value nested `levels` deep (iteratively built, as JSON.parse would deliver it). */
function deepValue(levels: number): unknown {
  let value: unknown = 'end';
  for (let i = 0; i < levels; i += 1) value = [value];
  return value;
}

describe('measureCatalogTree', () => {
  it('counts depth, nodes, branching and roots', () => {
    const { metrics } = measureCatalogTree(chain(4));
    expect(metrics.depth).toBe(4);
    expect(metrics.nodes).toBe(4);
    expect(metrics.branching).toBe(1);
    expect(metrics.roots).toBe(1);
    expect(metrics.bytes).toBeGreaterThan(0);

    const manyRoots = measureCatalogTree([
      { id: 'card', props: { title: 'a' } },
      { id: 'card', props: { title: 'b' } },
    ]);
    expect(manyRoots.metrics.roots).toBe(2);
    expect(manyRoots.metrics.nodes).toBe(2);

    const w = measureCatalogTree(wide(5));
    expect(w.metrics.branching).toBe(5);
    expect(w.metrics.nodes).toBe(6);
  });

  it('byte budget matches UTF-8 length of the canonical snapshot', () => {
    const tree = { id: 'card', props: { title: 'café' } };
    const { metrics, snapshot } = measureCatalogTree(tree);
    expect(metrics.bytes).toBe(utf8ByteLength(snapshot));
    expect(snapshot).toContain('caf');
  });

  it('measures a value nested far past any limit without overflowing the stack', () => {
    const tree = { id: 'card', props: { title: 'bomb', data: deepValue(100_000) } };
    const { metrics, diagnostics } = measureCatalogTree(tree);
    expect(metrics.nodes).toBe(1);
    expect(diagnostics.some((d) => d.code === 'value-depth-exceeded')).toBe(true);
  });

  it('caps the snapshot depth so byte measurement itself cannot recurse without bound', () => {
    const { snapshot } = measureCatalogTree({ id: 'card', props: { data: deepValue(100_000) } });
    expect(snapshot.length).toBeLessThan(10_000);
  });
});

describe('validateCatalogTreeLimits', () => {
  it('passes a small tree under defaults', () => {
    const result = validateCatalogTreeLimits({
      id: 'card',
      props: { title: 'ok' },
    });
    expect(result.ok).toBe(true);
    expect(result.limits.maxDepth).toBe(DEFAULT_TREE_LIMITS.maxDepth);
    expect(result.diagnostics.filter((d) => d.code.endsWith('-exceeded'))).toEqual([]);
  });

  it('rejects over-deep trees', () => {
    const result = validateCatalogTreeLimits(chain(5), { maxDepth: 3 });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'depth-exceeded')).toBe(true);
    expect(result.metrics.depth).toBe(5);
  });

  it('rejects too many nodes', () => {
    const result = validateCatalogTreeLimits(wide(10), { maxNodes: 5, maxBranching: 100 });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'nodes-exceeded')).toBe(true);
  });

  it('rejects excessive branching', () => {
    const result = validateCatalogTreeLimits(wide(20), { maxBranching: 8, maxNodes: 1000 });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'branching-exceeded')).toBe(true);
  });

  it('rejects too many roots', () => {
    const roots = Array.from({ length: 10 }, (_, i) => ({
      id: 'card',
      props: { title: `r${i}` },
    }));
    const result = validateCatalogTreeLimits(roots, { maxRoots: 3 });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'roots-exceeded')).toBe(true);
  });

  it('rejects oversized byte snapshots', () => {
    const fat = {
      id: 'card',
      props: { title: 'x'.repeat(2000) },
    };
    const result = validateCatalogTreeLimits(fat, { maxBytes: 500 });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'bytes-exceeded')).toBe(true);
  });
});

describe('renderCatalogTreeWithLimits', () => {
  it('renders when within limits', () => {
    const result = renderCatalogTreeWithLimits(
      { id: 'card', props: { title: 'Hello', variant: 'elevated' } },
      { catalog, tier: 'untrusted' }
    );
    expect(result.withinLimits).toBe(true);
    expect(result.roots).toHaveLength(1);
    expect(result.roots[0]).toMatchObject({ kind: 'component', id: 'card' });
  });

  it('does not call through to a full render when limits fail', () => {
    const result = renderCatalogTreeWithLimits(chain(20), {
      catalog,
      tier: 'untrusted',
      limits: { maxDepth: 4 },
    });
    expect(result.withinLimits).toBe(false);
    expect(result.roots).toEqual([]);
    expect(result.limitDiagnostics.some((d) => d.code === 'depth-exceeded')).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('depth-exceeded'))).toBe(true);
  });

  it('uses maxBranching as the per-node child cap when maxChildren is omitted', () => {
    const result = renderCatalogTreeWithLimits(wide(3), {
      catalog,
      limits: { maxBranching: 3, maxNodes: 100 },
    });
    expect(result.withinLimits).toBe(true);
    expect(result.roots[0]).toMatchObject({ kind: 'component' });
    if (result.roots[0]?.kind === 'component') {
      expect(result.roots[0].children).toHaveLength(3);
    }
  });

  it('survives a value nested far past any limit: the limits gate refuses, nothing renders', () => {
    const tree = { id: 'card', props: { title: 'bomb', data: deepValue(100_000) } };
    const result = renderCatalogTreeWithLimits(tree, { catalog, tier: 'untrusted' });
    expect(result.withinLimits).toBe(false);
    expect(result.roots).toEqual([]);
    expect(result.limitDiagnostics.some((d) => d.code === 'value-depth-exceeded')).toBe(true);
  });
});

describe('render time budget (perf-gated)', () => {
  const runPerf = process.env.TEXULI_PERF === '1';

  // Wall-clock assertions stay out of the default suite (lead rule).
  (runPerf ? it : it.skip)('enforces maxRenderMs when TEXULI_PERF=1', () => {
    const result = renderCatalogTreeWithLimits(
      { id: 'card', props: { title: 'perf' } },
      {
        catalog,
        limits: { maxRenderMs: 0 },
        enforceRenderTime: true,
      }
    );
    // 0ms budget is impossible for real work once measured.
    expect(result.renderMs).toBeTypeOf('number');
    if ((result.renderMs ?? 0) > 0) {
      expect(result.withinLimits).toBe(false);
      expect(result.limitDiagnostics.some((d) => d.code === 'time-exceeded')).toBe(true);
      expect(result.roots).toEqual([]);
    }
  });
});

describe('cyclic values', () => {
  /**
   * Measure a cyclic tree in a worker with a small heap and a deadline, so a
   * measurer that loops on the cycle fails this test quickly instead of
   * exhausting the test runner's heap.
   */
  function measureCyclicInWorker(): Promise<{ codes: string[]; ok: boolean }> {
    const measureUrl = new URL('../src/render/limits/validate.ts', import.meta.url).href;
    const source = `
      import { parentPort } from 'node:worker_threads';
      const { validateCatalogTreeLimits } = await import(${JSON.stringify(measureUrl)});
      const tree = { id: 'card', props: { title: 'loop', data: { items: [] } } };
      tree.props.data.items.push(tree);
      const result = validateCatalogTreeLimits(tree);
      parentPort.postMessage({ codes: result.diagnostics.map((d) => d.code), ok: result.ok });
    `;
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(source)}`), {
        resourceLimits: { maxOldGenerationSizeMb: 64 },
      });
      const deadline = setTimeout(() => {
        void worker.terminate();
        reject(new Error('Measuring a cyclic tree did not finish within 5 seconds.'));
      }, 5_000);
      worker.once('message', (message) => {
        clearTimeout(deadline);
        void worker.terminate();
        resolve(message as { codes: string[]; ok: boolean });
      });
      worker.once('error', (error) => {
        clearTimeout(deadline);
        reject(error);
      });
    });
  }

  it('refuses a cyclic tree with a value-cycle diagnostic instead of exhausting the heap', async () => {
    const result = await measureCyclicInWorker();
    expect(result.ok).toBe(false);
    expect(result.codes).toContain('value-cycle');
  });

  it('refuses a cyclic tree at the render gate: nothing renders', () => {
    const tree: Record<string, unknown> = { id: 'card', props: { title: 'loop' } };
    (tree.props as Record<string, unknown>).self = tree;
    const result = renderCatalogTreeWithLimits(tree, { catalog, tier: 'untrusted' });
    expect(result.withinLimits).toBe(false);
    expect(result.roots).toEqual([]);
    expect(result.limitDiagnostics.some((d) => d.code === 'value-cycle')).toBe(true);
  });

  it('accepts a value shared by two props (a repeated reference is not a cycle)', () => {
    const shared = { label: 'Shared' };
    const tree = { id: 'card', props: { title: 'twice', first: shared, second: shared } };
    const { diagnostics } = measureCatalogTree(tree);
    expect(diagnostics.some((d) => d.code === 'value-cycle')).toBe(false);
    expect(validateCatalogTreeLimits(tree).ok).toBe(true);
  });

  it('measures a shared value at its deepest reference, so sharing never hides depth', () => {
    const shared = deepValue(100);
    // Walked last-in first-out: `shallow` (depth 3) expands first, then the
    // same value under `deep` sits 40 levels lower, past the 128 limit.
    const tree = { id: 'card', props: { deep: deepValue(40), shallow: shared } };
    let cursor = tree.props.deep as unknown[];
    while (Array.isArray(cursor[0])) cursor = cursor[0] as unknown[];
    cursor[0] = shared;
    const { diagnostics } = measureCatalogTree(tree);
    expect(diagnostics.some((d) => d.code === 'value-depth-exceeded')).toBe(true);
    expect(diagnostics.some((d) => d.code === 'value-cycle')).toBe(false);
  });
});
