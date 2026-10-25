import { CHART_KINDS } from '@texuli/blocks/data/engine';
import { describe, expect, it } from 'vitest';
import { projectLegacyDeck } from '../src/grammar/index.ts';

function deckWith(chart: Record<string, unknown>) {
  return {
    id: 'layout-deck',
    props: { title: 'Harborline review' },
    children: [{ id: 'layout-card', props: { title: 'Numbers' }, children: [chart] }],
  };
}

function projectChart(id: string, props: Record<string, unknown>) {
  return projectLegacyDeck(deckWith({ id, props }));
}

describe('legacy deck projection of catalog chart nodes', () => {
  it('projects extended chart ids with their props', () => {
    const projected = projectChart('charts-pie', {
      title: 'Plan mix',
      description: 'Share of fictional workspaces by plan.',
      data: [{ id: 'team', label: 'Team', value: 62 }],
    });
    expect(projected.success).toBe(true);
    if (!projected.success) return;
    expect(projected.deck.slides[0]?.blocks[0]).toMatchObject({
      type: 'chart',
      kind: 'pie',
      title: 'Plan mix',
      props: { data: [{ id: 'team', label: 'Team', value: 62 }] },
    });
  });

  it('maps a compact chart label to the block title', () => {
    const projected = projectChart('charts-gauge', {
      label: 'Uptime',
      description: 'Fictional uptime this week.',
      value: 99,
    });
    expect(projected.success).toBe(true);
    if (!projected.success) return;
    expect(projected.deck.slides[0]?.blocks[0]).toMatchObject({
      kind: 'gauge',
      title: 'Uptime',
      props: { value: 99 },
    });
  });

  it('projects combo through charts-cartesian with inline series', () => {
    const projected = projectChart('charts-cartesian', {
      kind: 'combo',
      title: 'Load',
      description: 'Fictional load.',
      series: [{ id: 'a', label: 'A', points: [{ x: 'Mon', y: 1 }] }],
    });
    expect(projected.success).toBe(true);
  });

  it('accepts every blocks chart kind as a charts-<kind> id', () => {
    for (const kind of CHART_KINDS) {
      const result = projectChart(`charts-${kind}`, { title: 'T', description: 'D' });
      // Data is missing, so blocks rejects the props, never the id.
      expect(result.success, kind).toBe(false);
      if (result.success) continue;
      expect(result.issues[0]?.path, kind).not.toMatch(/\.id$/);
    }
  });

  it('keeps rejecting unknown ids and hostile props', () => {
    expect(projectChart('charts-radar', { title: 'T', description: 'D' })).toMatchObject({
      success: false,
      issues: [{ path: 'children[0].children[0].id' }],
    });
    expect(
      projectChart('charts-pie', {
        title: 'T',
        description: 'D',
        data: [{ id: 'a', label: 'A', value: 1 }],
        class: 'injected',
      }).success
    ).toBe(false);
  });
});
