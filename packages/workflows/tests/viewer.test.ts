import { render, screen, within } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import type { WorkflowNodeContext } from '../src/editor/index.ts';
import { defineNodeTypes, type WorkflowGraph } from '../src/model/index.ts';
import { WorkflowViewer } from '../src/viewer/index.ts';

const registry = defineNodeTypes([
  {
    type: 'request',
    label: 'Request',
    category: 'Approvals',
    ports: [{ id: 'out', direction: 'out', dataType: 'any', label: 'Submitted' }],
    props: { link: { kind: 'url', label: 'Form' } },
  },
  {
    type: 'review',
    label: 'Review',
    ports: [
      { id: 'in', direction: 'in', dataType: 'any' },
      { id: 'approve', direction: 'out', dataType: 'any', label: 'Approved' },
      { id: 'reject', direction: 'out', dataType: 'any', label: 'Rejected' },
    ],
  },
  { type: 'done', label: 'Done', ports: [{ id: 'in', direction: 'in', dataType: 'any' }] },
]);

/** A fictional approval flow, built without the model's checks to probe hostile input. */
const graph: WorkflowGraph = {
  version: '0.1',
  cycles: 'forbid',
  groups: [],
  nodes: [
    {
      id: 'ask',
      type: 'request',
      label: 'Expense request',
      position: { x: 0, y: 0 },
      props: { link: 'https://forms.example.com/expense' },
    },
    { id: 'lead', type: 'review', label: 'Team lead review', position: { x: 300, y: 0 } },
    { id: 'paid', type: 'done', label: 'Paid', position: { x: 600, y: -80 } },
    {
      id: 'closed',
      type: 'done',
      label: '<img src=x onerror=alert(1)>',
      position: { x: 600, y: 80 },
    },
    {
      id: 'bad',
      type: 'request',
      label: 'Bad link',
      position: { x: 0, y: 200 },
      props: { link: 'javascript:alert(1)' },
    },
  ],
  edges: [
    { id: 'e1', from: { node: 'ask', port: 'out' }, to: { node: 'lead', port: 'in' } },
    { id: 'e2', from: { node: 'lead', port: 'approve' }, to: { node: 'paid', port: 'in' } },
    { id: 'e3', from: { node: 'lead', port: 'reject' }, to: { node: 'closed', port: 'in' } },
  ],
};

describe('WorkflowViewer', () => {
  it('reads as a named figure with a list of nodes and their connections', () => {
    render(WorkflowViewer, { props: { graph, registry, label: 'Expense approval' } });
    const figure = screen.getByRole('figure', { name: 'Expense approval' });
    const items = within(figure).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    const lead = items[1] as HTMLElement;
    expect(lead.textContent).toContain('Team lead review');
    expect(lead.textContent).toContain('Approved to Paid');
    expect(lead.textContent).toContain('Rejected to <img src=x onerror=alert(1)>');
    expect(figure.querySelectorAll('svg path')).toHaveLength(3);
    expect(figure.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders labels as text and links only through the untrusted URL policy', () => {
    render(WorkflowViewer, { props: { graph, registry } });
    expect(document.querySelector('img[src="x"]')).toBeNull();
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://forms.example.com/expense',
    ]);
    expect(screen.getByRole('figure', { name: 'Workflow' })).toBeTruthy();
  });

  it('has no editing controls and accepts a custom node snippet', () => {
    const body = createRawSnippet((context: () => WorkflowNodeContext) => ({
      render: () => `<span class="custom">${context().spec?.label ?? ''}</span>`,
    }));
    render(WorkflowViewer, { props: { graph, registry, node: body } });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect([...document.querySelectorAll('.custom')].map((el) => el.textContent)).toEqual([
      'Request',
      'Review',
      'Done',
      'Done',
      'Request',
    ]);
  });

  it('lays out right to left and top to bottom from the same graph', () => {
    const { container } = render(WorkflowViewer, {
      props: { graph, registry, flow: 'TB', dir: 'rtl' },
    });
    expect(container.querySelector('figure')?.getAttribute('dir')).toBe('rtl');
    const path = container.querySelector('svg path')?.getAttribute('d') ?? '';
    // TB: the curve leaves the bottom edge of the source vertically.
    expect(path).toMatch(/^M[\d.-]+ [\d.-]+C/);
  });
});
