import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import FunnelChart from '../src/flow/FunnelChart.svelte';
import { networkLayout } from '../src/flow/model.ts';
import NetworkGraph from '../src/flow/NetworkGraph.svelte';
import SankeyChart from '../src/flow/SankeyChart.svelte';

afterEach(cleanup);

const nodes = [
  { id: 'visits', label: 'Visits' },
  { id: 'trial', label: 'Trial' },
  { id: 'paid', label: 'Paid' },
] as const;

const links = [
  { source: 'visits', target: 'trial', value: 80 },
  { source: 'trial', target: 'paid', value: 32 },
] as const;

describe('flow charts', () => {
  it('renders funnel steps with an accessible description and an expandable table, and 2 related cases', async () => {
    // renders funnel steps with an accessible description and an expandable table
    await (async () => {
      const { container } = render(FunnelChart, {
        props: {
          title: 'Signup funnel',
          description: 'People move from visits through trials to paid accounts.',
          steps: [
            { id: 'visits', label: 'Visits', value: 100 },
            { id: 'trials', label: 'Trials', value: 64 },
            { id: 'paid', label: 'Paid', value: 28 },
          ],
        },
      });
      const image = screen.getByRole('img', { name: 'Signup funnel' });
      expect(image.querySelector('desc')?.textContent).toContain('move from visits');
      expect(container.querySelectorAll('[data-step]')).toHaveLength(3);
      await fireEvent.click(screen.getByText('View data table'));
      expect(container.querySelector('table')?.textContent).toContain('Trials');
      expect(container.querySelector('table')?.textContent).toContain('64');
    })();
    cleanup();
    // renders Sankey flows, reports invalid graphs, and lists every connection
    await (async () => {
      const { container } = render(SankeyChart, {
        props: {
          title: 'Account flow',
          description: 'Visits continue through trial to paid accounts.',
          nodes,
          links,
        },
      });
      expect(
        screen.getByRole('img', { name: 'Account flow' }).querySelector('desc')?.textContent
      ).toContain('Visits continue');
      expect(container.querySelectorAll('[data-node]')).toHaveLength(3);
      expect(container.querySelectorAll('[data-flow]')).toHaveLength(2);
      await fireEvent.click(screen.getByText('View data table'));
      expect(container.querySelector('table')?.textContent).toContain('Visits');
      expect(container.querySelector('table')?.textContent).toContain('80');
      cleanup();

      render(SankeyChart, {
        props: {
          title: 'Invalid flow',
          nodes,
          links: [
            { source: 'visits', target: 'trial', value: 1 },
            { source: 'trial', target: 'paid', value: 1 },
            { source: 'paid', target: 'visits', value: 1 },
          ],
        },
      });
      expect(screen.getByRole('alert').textContent).toContain('cycle');
    })();
    cleanup();
    {
      // renders a deterministic network graph and rejects links to unknown nodes
      const { container } = render(NetworkGraph, {
        props: {
          title: 'Team network',
          description: 'Connections between the example team members.',
          nodes: [
            { id: 'ada', label: 'Ada' },
            { id: 'lin', label: 'Lin' },
            { id: 'sam', label: 'Sam' },
          ],
          links: [
            { source: 'ada', target: 'lin', value: 2 },
            { source: 'lin', target: 'sam' },
          ],
        },
      });
      expect(
        screen.getByRole('img', { name: 'Team network' }).querySelector('desc')?.textContent
      ).toContain('Connections between');
      expect(container.querySelectorAll('[data-node]')).toHaveLength(3);
      expect(container.querySelectorAll('[data-connection]')).toHaveLength(2);
      expect(networkLayout(nodes, links, 480, 360)).toEqual(networkLayout(nodes, links, 480, 360));
      cleanup();

      render(NetworkGraph, {
        props: {
          title: 'Invalid network',
          nodes,
          links: [{ source: 'visits', target: 'missing' }],
        },
      });
      expect(screen.getByRole('alert').textContent).toContain('unknown node');
    }
  });
});

describe('flow data-table disclosure', () => {
  // Every chart family gives its `details` summary the 2.75rem tap-target
  // row; this table takes it from the shared fallback stylesheet.
  it('gives the summary the family tap-target height', () => {
    const source = readFileSync(resolve(__dirname, '../src/flow/FlowDataTable.svelte'), 'utf8');
    expect(source).toContain("import '../table/ruled.css'");
    expect(source).toContain('<details class="tx-chart-ruled">');
    const shared = readFileSync(resolve(__dirname, '../src/table/ruled.css'), 'utf8');
    const summary = /\.tx-chart-ruled > summary \{([^}]*)\}/.exec(shared)?.[1] ?? '';
    expect(summary).toContain('min-block-size: 2.75rem');
    expect(summary).toContain('align-content: center');
  });
});
