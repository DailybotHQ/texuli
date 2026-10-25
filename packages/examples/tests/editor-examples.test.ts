import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('editor examples', () => {
  it.each([
    ['editor-basic', 'Release notes', false],
    ['editor-toolbar', 'Weekly update', true],
    ['editor-long-document', 'Team handbook', false],
  ])('%s registers, loads and renders a named textbox', async (id, name, toolbar) => {
    const entry = getExample(id);
    expect(entry?.component.startsWith('editor/')).toBe(true);
    const loaded = await entry?.load();
    if (!loaded) throw new Error(`${id} did not load.`);
    const { container, getByRole } = render(loaded.default);
    const textbox = getByRole('textbox', { name });
    expect(textbox.getAttribute('aria-multiline')).toBe('true');
    expect(container.querySelector('[role="toolbar"]') !== null).toBe(toolbar);
    expect(container.querySelector('script, [onclick], [onerror]')).toBeNull();
  });

  it('renders every block of the long document', async () => {
    const loaded = await getExample('editor-long-document')?.load();
    if (!loaded) throw new Error('long document did not load.');
    const { container } = render(loaded.default);
    expect(container.querySelectorAll('.tx-editor-surface > *').length).toBe(400);
  });
});
