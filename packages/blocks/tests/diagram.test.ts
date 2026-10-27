// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import DiagramFamily from '../src/diagram/DiagramFamily.svelte';
import {
  DIAGRAM_BLOCK_TYPES,
  DIAGRAM_LIMITS,
  isDiagramFamilyBlock,
  layoutFlow,
  layoutTree,
  parseDiagram,
} from '../src/diagram/index.ts';

afterEach(cleanup);

const flow = {
  type: 'flow',
  nodes: [
    { id: 'start', label: 'Collect brief' },
    { id: 'design', label: 'Design screens', tone: 'info' },
    { id: 'ship', label: 'Ship prototype' },
  ],
  loopBack: true,
};

const org = {
  type: 'tree',
  style: 'org',
  nodes: [
    { id: 'ceo', parentId: null, label: 'Alex Harbor' },
    { id: 'eng', parentId: 'ceo', label: 'Engineering' },
    { id: 'des', parentId: 'ceo', label: 'Design' },
    { id: 'fe', parentId: 'eng', label: 'Frontend' },
  ],
};

describe('parseDiagram', () => {
  it('accepts flow, tree, board and terminal models; rejects hostile and invalid input', () => {
    // accepts flow, tree, board and terminal models
    expect(parseDiagram(flow).success).toBe(true);
    expect(parseDiagram(org).success).toBe(true);
    expect(
      parseDiagram({
        type: 'board',
        columns: [
          {
            id: 'todo',
            title: 'Todo',
            cards: [{ id: 'c1', title: 'Write brief', tone: 'warning' }],
          },
        ],
      }).success
    ).toBe(true);
    expect(
      parseDiagram({
        type: 'terminal',
        lines: [
          { kind: 'prompt', text: 'pnpm build' },
          { kind: 'output', text: 'done' },
          { kind: 'comment', text: '# fictional' },
        ],
      }).success
    ).toBe(true);
    expect(DIAGRAM_BLOCK_TYPES).toEqual(['flow', 'tree', 'board', 'terminal']);
    expect(DIAGRAM_LIMITS.flowNodes).toBe(12);
    cleanup();
    {
      // rejects hostile and invalid input
      const html = parseDiagram({
        type: 'flow',
        nodes: [{ id: 'x', label: 'ok\u202eevil' }],
      });
      expect(html.success).toBe(false);

      const dup = parseDiagram({
        type: 'flow',
        nodes: [
          { id: 'a', label: 'One' },
          { id: 'a', label: 'Two' },
        ],
      });
      expect(dup.success).toBe(false);
      if (!dup.success) expect(dup.issues[0]?.jsonPath).toContain('id');

      const cycle = parseDiagram({
        type: 'tree',
        style: 'org',
        nodes: [
          { id: 'a', parentId: 'b', label: 'A' },
          { id: 'b', parentId: 'a', label: 'B' },
        ],
      });
      expect(cycle.success).toBe(false);

      const badType = parseDiagram({ type: 'sankey', nodes: [] });
      expect(badType.success).toBe(false);

      const tooMany = parseDiagram({
        type: 'flow',
        nodes: Array.from({ length: 20 }, (_, i) => ({
          id: `n${i}`,
          label: `Step ${i}`,
        })),
      });
      expect(tooMany.success).toBe(false);

      expect(isDiagramFamilyBlock(flow)).toBe(true);
      expect(isDiagramFamilyBlock({ type: 'heading', level: 1, text: 'Hi' })).toBe(false);
    }
  });
});

describe('layout', () => {
  it('lays out flow with loop-back and org tree edges', () => {
    const parsed = parseDiagram(flow);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    if (parsed.data.type !== 'flow') throw new Error('expected flow');
    const laid = layoutFlow(parsed.data);
    expect(laid.positions).toHaveLength(3);
    expect(laid.edges.some((e) => e.kind === 'loop-back')).toBe(true);

    const tree = parseDiagram(org);
    expect(tree.success).toBe(true);
    if (!tree.success) return;
    if (tree.data.type !== 'tree') throw new Error('expected tree');
    const orgLayout = layoutTree(tree.data);
    expect(orgLayout.positions).toHaveLength(4);
    expect(orgLayout.edges.length).toBeGreaterThan(0);
  });
});

describe('DiagramFamily render', () => {
  it('renders flow, org, board and terminal from validated data; shows a note when validation fails', () => {
    {
      // renders flow, org, board and terminal from validated data
      const flowView = render(DiagramFamily, { props: { block: flow } });
      expect(flowView.container.querySelector('[data-tx-diagram="flow"]')).toBeTruthy();
      expect(flowView.container.querySelector('[data-node="start"]')?.textContent).toContain(
        'Collect brief'
      );
      flowView.unmount();

      const orgView = render(DiagramFamily, { props: { block: org } });
      expect(orgView.container.querySelector('[data-tx-diagram="tree"]')).toBeTruthy();
      expect(orgView.container.querySelector('[data-node="ceo"]')?.textContent).toContain(
        'Alex Harbor'
      );
      orgView.unmount();

      const boardView = render(DiagramFamily, {
        props: {
          block: {
            type: 'board',
            columns: [
              { id: 'todo', title: 'Todo', cards: [{ id: 'c1', title: 'Ship deck' }] },
              { id: 'done', title: 'Done', cards: [] },
            ],
          },
        },
      });
      expect(boardView.container.querySelector('[data-tx-diagram="board"]')).toBeTruthy();
      expect(boardView.container.querySelector('[data-card="c1"]')?.textContent).toContain(
        'Ship deck'
      );
      boardView.unmount();

      const termView = render(DiagramFamily, {
        props: {
          block: {
            type: 'terminal',
            lines: [{ kind: 'prompt', text: 'echo hello' }],
          },
        },
      });
      expect(termView.container.querySelector('[data-tx-diagram="terminal"]')).toBeTruthy();
      expect(termView.container.textContent).toContain('echo hello');
      expect(termView.container.textContent).toContain('Command:');
      termView.unmount();
    }
    cleanup();
    {
      // shows a note when validation fails
      const view = render(DiagramFamily, {
        props: { block: { type: 'flow', nodes: [] } },
      });
      expect(view.container.querySelector('[data-tx-diagram-invalid]')).toBeTruthy();
    }
  });
});
