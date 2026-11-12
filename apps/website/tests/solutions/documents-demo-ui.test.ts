// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import DocumentsDemo from '../../src/components/solutions/documents/demo/DocumentsDemo.svelte';
import DocumentsDemoPreview from '../../src/components/solutions/documents/demo/DocumentsDemoPreview.svelte';

async function startDemo(root: HTMLElement): Promise<void> {
  const button = root.querySelector<HTMLButtonElement>('.documents-demo__start');
  expect(button).not.toBeNull();
  await fireEvent.click(button as HTMLButtonElement);
  await waitFor(() => expect(root.querySelector('.tx-pages-editor')).not.toBeNull(), {
    timeout: 10_000,
  });
}

describe('Documents Solution demo island', () => {
  it('renders a static reader preview from the same deterministic report fixture', () => {
    const { container } = render(DocumentsDemoPreview);
    expect(
      container.querySelector('[data-tx-documents-demo-preview="product-report"]')
    ).not.toBeNull();
    expect(container.querySelector('.tx-pages-reader')).not.toBeNull();
    expect(container.textContent).toContain('Lumen quarterly product report');
    expect(container.textContent).toContain('The numbers below are sample data, not real usage.');
    expect(container.querySelector('script, [onerror], [onclick]')).toBeNull();
  });

  it('renames and adds blocks, switches views, exposes plain source, and resets', async () => {
    const { container } = render(DocumentsDemo);
    await startDemo(container);

    const title = screen.getByRole('textbox', { name: 'Document title' });
    await fireEvent.input(title, { target: { value: 'Lumen report revised' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Update title' }));
    await waitFor(() => expect(container.textContent).toContain('Lumen report revised'));
    expect(screen.getByRole('status').textContent).toContain('Title updated');

    await fireEvent.change(screen.getByLabelText('Add a block'), { target: { value: 'callout' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add block' }));
    await waitFor(() =>
      expect(container.querySelector('[data-block-id="added-1"]')).not.toBeNull()
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Undo demo change' }));
    await waitFor(() => expect(container.querySelector('[data-block-id="added-1"]')).toBeNull());
    await fireEvent.click(screen.getByRole('button', { name: 'Redo demo change' }));
    await waitFor(() =>
      expect(container.querySelector('[data-block-id="added-1"]')).not.toBeNull()
    );

    await fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    expect(screen.getByRole('region', { name: 'Document source as JSON' }).textContent).toContain(
      'Lumen report revised'
    );
    expect(container.querySelector('pre')?.textContent).toContain('texuli-document');

    await fireEvent.click(screen.getByRole('button', { name: 'Read view' }));
    await waitFor(() => expect(container.querySelector('.tx-pages-reader')).not.toBeNull());
    await fireEvent.click(screen.getByRole('button', { name: 'Edit view' }));
    await waitFor(() => expect(container.querySelector('.tx-pages-editor')).not.toBeNull());

    await fireEvent.click(screen.getByRole('button', { name: 'Reset example' }));
    await waitFor(() => expect(container.textContent).toContain('Lumen quarterly product report'));
    expect(container.querySelector('[data-block-id="added-1"]')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Document source as JSON' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Example reset');
  }, 15_000);

  it('supports keyboard form submission and touch-sized native controls', async () => {
    const { container } = render(DocumentsDemo);
    await startDemo(container);

    const title = screen.getByRole('textbox', { name: 'Document title' });
    await fireEvent.input(title, { target: { value: 'Keyboard revised report' } });
    await fireEvent.keyDown(title, { key: 'Enter' });
    await fireEvent.submit(screen.getByRole('form', { name: 'Rename document title' }));
    await waitFor(() => expect(container.textContent).toContain('Keyboard revised report'));

    const reset = screen.getByRole('button', { name: 'Reset example' });
    expect(reset.getAttribute('type')).toBe('button');
    expect(container.querySelector('.documents-controls')?.textContent).toContain('Reset example');
    await fireEvent.pointerDown(reset, { pointerId: 4, pointerType: 'touch' });
    await fireEvent.pointerUp(reset, { pointerId: 4, pointerType: 'touch' });
    await fireEvent.click(reset);
    await waitFor(() => expect(container.textContent).toContain('Lumen quarterly product report'));
    expect(container.querySelector('.tx-pages-editor')).not.toBeNull();
  });
});
