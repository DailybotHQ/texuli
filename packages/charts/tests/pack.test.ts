import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { pack } from '../src/math/index.ts';
import { createPackLayout, type PackTree, packColor } from '../src/pack/model.ts';
import PackChart from '../src/pack/PackChart.svelte';

afterEach(cleanup);

const root: PackTree = {
  id: 'workspace',
  label: 'Example workspace',
  children: [
    {
      id: 'product',
      label: 'Product',
      children: [
        { id: 'design', label: 'Design', value: 8 },
        { id: 'engineering', label: 'Engineering', value: 20 },
      ],
    },
    {
      id: 'operations',
      label: 'Operations',
      children: [
        { id: 'support', label: 'Support', value: 7 },
        { id: 'finance', label: 'Finance', value: 5 },
      ],
    },
  ],
};

describe('pack model', () => {
  it('uses pack math and preserves hierarchy geometry and values', () => {
    const options = { width: 400, height: 300, padding: 3 };
    expect(createPackLayout(root, options)).toEqual(pack(root, options));
    const layout = createPackLayout(root, options);
    expect(layout.filter((circle) => circle.leaf)).toHaveLength(4);
    expect(layout[0]).toMatchObject({ id: 'workspace', value: 40, depth: 0 });
    expect(packColor(0)).toContain('--tx-chart-1');
    const clamped = createPackLayout(root, { width: -1, height: Number.NaN });
    expect(clamped[0]).toMatchObject({ x: 60, y: 210 });
  });
});

describe('PackChart', () => {
  it('renders leaf circles, group outlines and every node in the table', async () => {
    const { container } = render(PackChart, {
      title: 'Team capacity',
      description: 'Circle area represents each fictional team capacity.',
      root,
    });

    expect(screen.getByRole('img', { name: /Team capacity/ })).toBeTruthy();
    expect(container.querySelectorAll('[data-circle]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-group]')).toHaveLength(3);
    await fireEvent.click(screen.getByText('View data table'));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(7);
    expect(container.querySelector('table')?.textContent).toContain('Engineering');
  });

  it('requires an accessible description', () => {
    expect(() => render(PackChart, { title: 'Capacity', description: '', root })).toThrow(
      /accessible description/
    );
  });
});
