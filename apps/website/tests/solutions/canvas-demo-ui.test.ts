import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { budgetFor, islandBudgetFor } from '../../src/components/perf/budgets.ts';
import CanvasDemo from '../../src/components/solutions/canvas/demo/CanvasDemo.svelte';
import CanvasPreview from '../../src/components/solutions/canvas/demo/CanvasPreview.svelte';

afterEach(cleanup);

const UI_SOURCE = resolve('apps/website/src/components/solutions/canvas/demo/CanvasDemo.svelte');

describe('canvas solution demo island', () => {
  it('renders the deterministic launch plan fixture in the static preview', () => {
    render(CanvasPreview);

    expect(screen.getByRole('img', { name: 'Launch plan canvas preview' })).toBeTruthy();
    const preview = document.querySelector('figure');
    expect(preview?.textContent).toContain('Talk to twelve customers');
    expect(preview?.textContent).toContain('Choose the beta scope');
    expect(preview?.textContent).toContain('Prepare the release');
  });

  it('selects and moves a shape, adds a note, connects shapes and resets the model', async () => {
    render(CanvasDemo);

    const interview = screen.getByRole('button', { name: 'Talk to twelve customers, sticky' });
    await fireEvent.click(interview);
    expect(screen.getByText('1 shapes selected')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Move right' }));
    expect(screen.getByRole('status').textContent).toContain('Selected shape moved.');

    await fireEvent.click(screen.getByRole('button', { name: 'Add priority note' }));
    expect(screen.getByRole('status').textContent).toContain('Priority note added and selected.');
    await fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    expect(document.getElementById('canvas-demo-source')?.textContent).toContain(
      'Confirm beta launch date'
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Hide source' }));
    await fireEvent.click(screen.getByLabelText('Add selected shapes to the connection selection'));
    await fireEvent.click(screen.getByRole('button', { name: 'Talk to twelve customers, sticky' }));
    await fireEvent.click(screen.getByLabelText('Add selected shapes to the connection selection'));
    await fireEvent.click(screen.getByRole('button', { name: 'Talk to twelve customers, sticky' }));
    await fireEvent.click(screen.getByLabelText('Add selected shapes to the connection selection'));
    await fireEvent.click(screen.getByRole('button', { name: 'Test the first prototype, sticky' }));
    const connect = screen.getByRole('button', { name: 'Connect selected' });
    expect(connect.hasAttribute('disabled')).toBe(false);
    await fireEvent.click(connect);
    expect(screen.getByRole('status').textContent).toContain('Selected shapes connected.');

    await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('status').textContent).toContain('reset to its starting example');
    expect(screen.getByText('0 shapes selected')).toBeTruthy();
    expect(document.getElementById('canvas-demo-source')?.hasAttribute('hidden')).toBe(true);
  });

  it('moves a selected shape with keyboard arrows and makes the structure available to assistive technology', async () => {
    render(CanvasDemo);
    const shape = screen.getByRole('button', { name: 'Choose the beta scope, sticky' });
    shape.focus();
    await fireEvent.keyDown(shape, { key: 'ArrowRight' });

    expect(screen.getByRole('status').textContent).toContain('Selected shape moved.');
    expect(shape.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('img', { name: 'Launch plan canvas' })).toBeTruthy();
  });

  it('keeps touch targets, reduced-motion behavior, safe text rendering, and route limits', () => {
    const source = readFileSync(UI_SOURCE, 'utf8');
    expect(source).toContain('touch-action: manipulation');
    expect(source).toContain('min-block-size: 2.75rem');
    expect(source).toContain('prefers-reduced-motion: reduce');
    expect(source).not.toMatch(/\{@html|innerHTML|fetch\s*\(/);
    expect(source).toContain('{source}');
    expect(source).toContain("import { CanvasViewer } from '@texuli/canvas/viewer'");
    expect(islandBudgetFor('/solutions/canvas/')).toBe(1);
    expect(budgetFor('/solutions/canvas/').pageGzipKb).toBe(169);
    expect(budgetFor('/solutions/canvas/').jsGzipKb).toBe(64);
  });
});
