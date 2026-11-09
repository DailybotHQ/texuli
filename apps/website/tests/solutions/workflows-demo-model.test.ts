import { describe, expect, it } from 'vitest';
import { createExpenseApprovalGraph } from '../../src/components/solutions/workflows/demo/fixtures/expense-approval.ts';
import { createWorkflowDemoModel } from '../../src/components/solutions/workflows/demo/model.ts';

describe('workflow solution demo model', () => {
  it('starts from a deterministic expense approval graph', () => {
    const first = createExpenseApprovalGraph();
    const second = createExpenseApprovalGraph();

    expect(first).toEqual(second);
    expect(first.nodes.map(({ label }) => label)).toEqual([
      'Submit expense',
      'Manager review',
      'Approved',
      'Rejected',
    ]);
    expect(first.edges).toHaveLength(3);
  });

  it('selects a node, changes its label through a validated package op, and undoes/redoes it', () => {
    const model = createWorkflowDemoModel();

    expect(model.selectNode('manager-review')).toBe(true);
    expect(model.selectedNodeId).toBe('manager-review');
    expect(model.changeSelectedNodeLabel('Finance approval')).toMatchObject({ ok: true });
    expect(model.graph.nodes.find(({ id }) => id === 'manager-review')?.label).toBe(
      'Finance approval'
    );
    expect(model.undo()).toBe(true);
    expect(model.graph.nodes.find(({ id }) => id === 'manager-review')?.label).toBe(
      'Manager review'
    );
    expect(model.redo()).toBe(true);
    expect(model.graph.nodes.find(({ id }) => id === 'manager-review')?.label).toBe(
      'Finance approval'
    );
  });

  it('adds a palette step, accepts compatible ports and reports incompatible ports without mutation', () => {
    const model = createWorkflowDemoModel();

    expect(model.addStepFromPalette()).toMatchObject({ ok: true });
    expect(
      model.graph.nodes.some(
        ({ id, type }) => id === 'notify-requester-1' && type === 'notification'
      )
    ).toBe(true);
    expect(
      model.connectPorts(
        { node: 'manager-review', port: 'approved' },
        { node: 'notify-requester-1', port: 'decision' }
      )
    ).toMatchObject({ ok: true });

    const graphBeforeRefusal = model.graph;
    const refused = model.connectPorts(
      { node: 'expense-request', port: 'submitted' },
      { node: 'notify-requester-1', port: 'decision' }
    );
    expect(refused).toMatchObject({ ok: false, error: { code: 'port-type' } });
    expect(model.lastError?.code).toBe('port-type');
    expect(model.graph).toBe(graphBeforeRefusal);
  });

  it('auto-layouts through the package layout API and reset restores the baseline', () => {
    const model = createWorkflowDemoModel();
    const baseline = createExpenseApprovalGraph();

    expect(model.selectNode('manager-review')).toBe(true);
    expect(model.addStepFromPalette()).toMatchObject({ ok: true });
    const positionsBeforeLayout = model.graph.nodes.map(({ id, position }) => [id, position]);
    expect(model.autoLayout('TB')).toMatchObject({ ok: true });
    const laidOutPositions = model.graph.nodes.map(({ id, position }) => [id, position]);
    expect(laidOutPositions).not.toEqual(positionsBeforeLayout);
    expect(model.canUndo).toBe(true);

    const repeated = createWorkflowDemoModel();
    repeated.addStepFromPalette();
    repeated.autoLayout('TB');
    expect(repeated.graph.nodes.map(({ id, position }) => [id, position])).toEqual(
      laidOutPositions
    );

    model.reset();
    expect(model.graph).toEqual(baseline);
    expect(model.selectedNodeId).toBeNull();
    expect(model.lastError).toBeNull();
    expect(model.canUndo).toBe(false);
    expect(model.canRedo).toBe(false);
  });

  it('requires a selection before editing and can reset generated ids deterministically', () => {
    const model = createWorkflowDemoModel();

    expect(model.changeSelectedNodeLabel('No selection')).toMatchObject({
      ok: false,
      error: { code: 'unknown-id' },
    });
    expect(model.selectNode('missing')).toBe(false);
    expect(model.addStepFromPalette()).toMatchObject({ ok: true });
    model.reset();
    expect(model.addStepFromPalette()).toMatchObject({ ok: true });
    expect(model.graph.nodes.some(({ id }) => id === 'notify-requester-1')).toBe(true);
  });
});
