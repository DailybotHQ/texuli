// @vitest-environment node
/**
 * Perf-only wall-clock coverage for catalog tree limits.
 * Run via: `TEXULI_PERF=1 pnpm vitest run tests/perf/catalog-render-limits.test.ts`
 * (or the repo `test:perf` script once the lead unions this path).
 */
import { describe, expect, it } from 'vitest';
import { renderCatalogTreeWithLimits } from '../../packages/catalog/src/render/limits/index.ts';
import {
  type RenderComponentSpec,
  renderCatalogFromSpecs,
} from '../../packages/catalog/src/render/renderer/index.ts';

const card: RenderComponentSpec = {
  id: 'card',
  label: 'Card',
  agentEmittable: true,
  emit: ['developer', 'untrusted'],
  props: [{ name: 'title', kind: 'string' }],
};

const catalog = renderCatalogFromSpecs([card]);

describe('catalog render limits (perf)', () => {
  it('records renderMs and can fail a zero millisecond budget', () => {
    expect(process.env.TEXULI_PERF).toBe('1');
    const result = renderCatalogTreeWithLimits(
      { id: 'card', props: { title: 'x' } },
      { catalog, enforceRenderTime: true, limits: { maxRenderMs: 0 } }
    );
    expect(result.renderMs).toBeTypeOf('number');
    expect(result.renderMs ?? 0).toBeGreaterThanOrEqual(0);
    if ((result.renderMs ?? 0) > 0) {
      expect(result.withinLimits).toBe(false);
      expect(result.limitDiagnostics.some((d) => d.code === 'time-exceeded')).toBe(true);
    }
  });
});
