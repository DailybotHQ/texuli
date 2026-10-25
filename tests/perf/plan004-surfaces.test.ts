// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { paintProps } from '../../packages/catalog/src/player/paint-props.ts';
import {
  formulaConditions,
  parseWhen,
} from '../../packages/catalog/src/render/conditions/index.ts';
import { formatChartValue } from '../../packages/charts/src/compact/shared.ts';
import {
  compositionLeaves,
  sampleCompositionV2,
  validateAnimationV2,
  validateCompositionV2,
} from '../../packages/media/src/composition-v2/index.ts';
import { exportQueue } from '../../packages/media/src/export/index.ts';
import {
  createTimelineHistory,
  TIMELINE_LIMITS,
  timelineHistoryReducer,
  timelineRows,
} from '../../packages/media/src/timeline/model-index.ts';
import { resolveStateBindings } from '../../packages/player/src/state/bind.ts';
import {
  MAX_FLOW_TRANSITIONS,
  MAX_FLOW_VIEWS,
  nextFlowView,
  parseFlowDeclaration,
} from '../../packages/player/src/state/flow.ts';

declare const process: { env: Record<string, string | undefined> };

/*
 * Wall-clock and scale limits for the surfaces PLAN_004 added: player flows
 * and local state, media composition v2, timeline history and the export
 * queue, catalog conditions and paint-time srcset policing, and chart value
 * formats. Same shape as the other perf files: inputs at each surface's
 * declared limit, an output bound, and a budget calibrated against a native
 * 100k sort on the same machine.
 */

function createRng(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function bestOfThree(work: () => unknown): number {
  work();
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    work();
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

async function bestOfThreeAsync(work: () => Promise<unknown>): Promise<number> {
  await work();
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    await work();
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

const random = createRng('plan004-surfaces');
const baselineMs = bestOfThree(() => Float64Array.from({ length: 100_000 }, random).sort());
const budget = (floorMs: number, factor: number) => Math.max(floorMs, factor * baselineMs);
const report = (name: string, ms: number) => {
  if (process.env.TEXULI_PERF_REPORT === '1') {
    console.log(`[perf] ${name}: ${ms.toFixed(1)} ms (baseline ${baselineMs.toFixed(1)} ms)`);
  }
};

const golden = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../../packages/media/tests/golden/composition-v2/lower-third.json'),
    'utf8'
  )
) as { composition: unknown; animation: unknown };

describe('PLAN_004 surface limits', () => {
  it('player: evaluates 100k flow events against a maximum flow declaration', {
    timeout: 60_000,
  }, () => {
    const views = Array.from({ length: MAX_FLOW_VIEWS }, (_, i) => `view-${i}`);
    const guard = { op: 'gt', left: { op: 'var', name: 'step' }, right: { op: 'num', value: 0 } };
    const transitions = Array.from({ length: MAX_FLOW_TRANSITIONS }, (_, i) => ({
      from: i % 8 === 0 ? '*' : views[i % MAX_FLOW_VIEWS],
      to: views[(i + 1) % MAX_FLOW_VIEWS],
      on: `event-${i % 12}`,
      ...(i % 2 === 0 ? { when: guard } : {}),
    }));
    const parsed = parseFlowDeclaration({ views, initial: views[0], transitions });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    let current = views[0] as string;
    let moved = 0;
    const ms = bestOfThree(() => {
      for (let i = 0; i < 100_000; i++) {
        const next = nextFlowView(parsed.flow, current, `event-${i % 12}`, { step: i % 3 });
        if (next) {
          current = next;
          moved += 1;
        }
      }
    });
    report('player-flow-100k-events', ms);
    expect(moved).toBeGreaterThan(0);
    expect(ms).toBeLessThan(budget(400, 40));
  });

  it('player: resolves state bindings across a 512-node blueprint', { timeout: 60_000 }, () => {
    const blueprint = {
      id: 'layout-page',
      props: { title: { $state: 'title' } },
      children: Array.from({ length: 511 }, (_, i) => ({
        id: 'layout-card',
        props: {
          title: { $state: i % 2 ? 'title' : 'count' },
          rows: [{ label: { $state: 'count' } }, { label: `Row ${i}` }],
        },
      })),
    };
    let issues = -1;
    const ms = bestOfThree(() => {
      for (let i = 0; i < 50; i++) {
        issues = resolveStateBindings(blueprint, { title: 'Fictional', count: i }).issues.length;
      }
    });
    report('player-bindings-512-nodes-x50', ms);
    expect(issues).toBe(0);
    expect(ms).toBeLessThan(budget(400, 40));
  });

  it('media: samples the golden composition at 60 fps and validates 256-node trees', {
    timeout: 60_000,
  }, () => {
    const composition = validateCompositionV2(golden.composition);
    if (!composition.ok) throw new Error('composition');
    const animation = validateAnimationV2(golden.animation, composition.composition);
    if (!animation.ok) throw new Error('animation');
    const frames = Math.ceil((composition.composition.durationMs ?? 0) / (1000 / 60));
    const sampleMs = bestOfThree(() => {
      for (let frame = 0; frame <= frames; frame++) {
        sampleCompositionV2(composition.composition, animation.animation, (frame * 1000) / 60);
      }
    });
    report('media-sample-golden-60fps', sampleMs);
    expect(frames).toBe(360);
    expect(sampleMs).toBeLessThan(budget(300, 30));

    // 32 groups of 7 shapes plus the groups: 256 nodes, the declared maximum.
    const wide = {
      version: 2,
      width: 1280,
      height: 720,
      durationMs: 6000,
      layers: Array.from({ length: 32 }, (_, g) => ({
        id: `group-${g}`,
        type: 'group',
        timing: { startMs: 0, endMs: 6000 },
        children: Array.from({ length: 7 }, (_, c) => ({
          id: `shape-${g}-${c}`,
          type: 'shape',
          shape: 'rectangle',
          frame: { x: c * 10, y: g * 10, width: 8, height: 8 },
          fill: { kind: 'solid', color: '#0b1d33' },
        })),
      })),
    };
    let ok = false;
    const validateMs = bestOfThree(() => {
      for (let i = 0; i < 20; i++) ok = validateCompositionV2(wide).ok;
    });
    report('media-validate-256-nodes-x20', validateMs);
    expect(ok).toBe(true);
    expect(validateMs).toBeLessThan(budget(400, 40));
  });

  it('media: applies 1,000 timeline edits with a bounded undo history', { timeout: 60_000 }, () => {
    const composition = validateCompositionV2(golden.composition);
    if (!composition.ok) throw new Error('composition');
    const animation = validateAnimationV2(golden.animation, composition.composition);
    if (!animation.ok) throw new Error('animation');
    const start = { composition: composition.composition, animation: animation.animation };
    let history = createTimelineHistory(start);
    const ms = bestOfThree(() => {
      history = createTimelineHistory(start);
      history = timelineHistoryReducer(history, {
        type: 'apply',
        action: { type: 'add-keyframe', layerId: 'bar', timeMs: 3000 },
      });
      for (let i = 0; i < 1_000; i++) {
        history = timelineHistoryReducer(history, {
          type: 'apply',
          action: { type: 'move-keyframe', layerId: 'bar', index: 0, timeMs: 3000 + (i % 500) },
        });
      }
      timelineRows(history.present);
    });
    report('media-timeline-1000-edits', ms);
    expect(history.past.length).toBeLessThanOrEqual(TIMELINE_LIMITS.maxHistory);
    expect(ms).toBeLessThan(budget(500, 50));
  });

  it('media: runs a 100-item SVG export queue with one receipt per item', {
    timeout: 60_000,
  }, async () => {
    const composition = validateCompositionV2(golden.composition);
    if (!composition.ok) throw new Error('composition');
    const items = Array.from({ length: 100 }, (_, i) => ({
      format: 'svg' as const,
      // The exporters take flat v1 leaves; a v2 document is flattened first.
      input: compositionLeaves(composition.composition),
      options: { filename: `poster-${i}` },
    }));
    let receipts = 0;
    let succeeded = 0;
    const ms = await bestOfThreeAsync(async () => {
      const result = await exportQueue(items);
      receipts = result.receipts.length;
      succeeded = result.receipts.filter((receipt) => receipt.status === 'succeeded').length;
    });
    report('media-export-queue-100-svg', ms);
    expect(receipts).toBe(100);
    expect(succeeded).toBe(100);
    expect(ms).toBeLessThan(budget(1_000, 80));
  });

  it('catalog: parses and evaluates 10k render conditions', { timeout: 60_000 }, () => {
    const condition = {
      op: 'and',
      args: [
        { op: 'gt', left: { op: 'var', name: 'count' }, right: { op: 'num', value: 2 } },
        { op: 'eq', left: { op: 'var', name: 'agree' }, right: { op: 'num', value: 1 } },
      ],
    };
    let truthy = 0;
    const ms = bestOfThree(() => {
      truthy = 0;
      for (let i = 0; i < 10_000; i++) {
        const parsed = parseWhen(condition);
        if (!parsed.ok) throw new Error(parsed.message);
        if (formulaConditions.evaluate(parsed.condition, { count: i % 5, agree: i % 2 }) === true) {
          truthy += 1;
        }
      }
    });
    report('catalog-conditions-10k', ms);
    expect(truthy).toBeGreaterThan(0);
    expect(ms).toBeLessThan(budget(400, 40));
  });

  it('catalog: polices 1,000 srcset props with eight candidates each at paint time', {
    timeout: 60_000,
  }, () => {
    const candidate = (i: number) => `https://images.example.com/photo-${i}.jpg ${(i % 4) + 1}x`;
    const props = {
      gallery: Array.from({ length: 1_000 }, (_, i) => ({
        alt: `Photo ${i}`,
        srcset: Array.from({ length: 8 }, (_, c) => candidate(i * 8 + c)).join(', '),
        ...(i % 50 === 0
          ? { imageSrcset: 'javascript:alert(1) 1x, https://images.example.com/a.jpg 2x' }
          : {}),
      })),
    };
    let removed = 0;
    const ms = bestOfThree(() => {
      const issues: { path: string; message: string }[] = [];
      paintProps(props, issues);
      removed = issues.length;
    });
    report('catalog-paint-srcset-1000x8', ms);
    expect(removed).toBe(20);
    expect(ms).toBeLessThan(budget(400, 40));
  });

  it('charts: formats 100k values with declarative number, currency and date formats', {
    timeout: 60_000,
  }, () => {
    const specs = [
      { type: 'number' as const, notation: 'compact' as const },
      { type: 'number' as const, style: 'currency' as const, currency: 'USD', locale: 'en-US' },
      { type: 'date' as const, dateStyle: 'medium' as const, timeZone: 'UTC' },
    ];
    let chars = 0;
    const ms = bestOfThree(() => {
      chars = 0;
      for (let i = 0; i < 100_000; i++) {
        chars += formatChartValue(1_700_000_000_000 + i * 1_000, specs[i % 3]).length;
      }
    });
    report('charts-format-100k', ms);
    expect(chars).toBeGreaterThan(0);
    // One cached Intl formatter per spec; before the cache this took about 8.5 s.
    expect(ms).toBeLessThan(budget(1_000, 80));
  });
});
