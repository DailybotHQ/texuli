import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { budgetFor, islandBudgetFor } from '../../src/components/perf/budgets.ts';
import WorkflowPreview from '../../src/components/solutions/workflows/demo/WorkflowPreview.svelte';
import WorkflowsDemo from '../../src/components/solutions/workflows/demo/WorkflowsDemo.svelte';

afterEach(cleanup);

const UI_SOURCE = resolve(
  'apps/website/src/components/solutions/workflows/demo/WorkflowsDemo.svelte'
);

describe('workflow solution demo island', () => {
  it('renders the same expense approval fixture as a static server preview', () => {
    render(WorkflowPreview);

    const figure = screen.getByRole('figure', { name: 'Expense approval workflow preview' });
    expect(figure.textContent).toContain('Submit expense');
    expect(figure.textContent).toContain('Manager review');
    expect(figure.textContent).toContain('Approved');
    expect(figure.textContent).toContain('Rejected');
  });

  it('adds a step, changes its label, lays out, and resets the real workflow model', async () => {
    render(WorkflowsDemo);

    expect(screen.getByText('4 steps · 3 connections')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Add notification' }));
    expect(screen.getByText('5 steps · 3 connections')).toBeTruthy();
    expect(screen.getByRole('button', { name: '5 Notify requester' })).toBeTruthy();

    const editor = screen.getByRole('form');
    await fireEvent.input(within(editor).getByLabelText('Step label'), {
      target: { value: 'Send approval update' },
    });
    await fireEvent.click(within(editor).getByRole('button', { name: 'Update label' }));
    expect(screen.getByRole('button', { name: '5 Send approval update' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Step label updated.');

    await fireEvent.click(screen.getByRole('button', { name: 'Auto layout' }));
    expect(screen.getByRole('status').textContent).toContain(
      'Workflow arranged from left to right.'
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('4 steps · 3 connections')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '5 Send approval update' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('reset to its starting example');
  });

  it('supports arrow-key step navigation and exposes the current graph as text', async () => {
    render(WorkflowsDemo);
    const first = screen.getByRole('button', { name: '1 Submit expense' });
    first.focus();
    await fireEvent.keyDown(first, { key: 'ArrowDown' });

    const second = screen.getByRole('button', { name: '2 Manager review' });
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute('aria-pressed')).toBe('true');

    await fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    const sourceButton = screen.getByRole('button', { name: 'Hide source' });
    expect(sourceButton.getAttribute('aria-expanded')).toBe('true');
    const source = document.getElementById('workflow-demo-source');
    expect(source?.textContent).toContain('"version"');
    expect(source?.textContent).toContain('manager-review');
  });

  it('keeps touch targets, reduced-motion behavior, safe text rendering, and route limits', () => {
    const source = readFileSync(UI_SOURCE, 'utf8');
    expect(source).toContain('touch-action: manipulation');
    expect(source).toContain('min-block-size: 2.75rem');
    expect(source).toContain('prefers-reduced-motion: reduce');
    expect(source).not.toMatch(/\{@html|innerHTML|fetch\s*\(/);
    expect(source).toContain('{source}');
    expect(source).toContain("import { WorkflowViewer } from '@texuli/workflows/viewer'");
    expect(islandBudgetFor('/solutions/workflows/')).toBe(1);
    expect(budgetFor('/solutions/workflows/').jsGzipKb).toBe(96);
  });
});
