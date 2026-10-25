import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { PLAYER_NODE_ERROR_CODES, placeholderMessage } from '../src/errors.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import Player from '../src/Player.svelte';

const layoutLoader = async () =>
  import('../src/layouts/ContentLayout.svelte').then((m) => m.default);

const report = {
  id: 'layout-doc',
  props: { title: 'Fictional delivery report' },
  children: [
    { id: 'blocks-text', props: { block: { type: 'text', markdown: 'First sample.' } } },
    { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Second sample.' } } },
  ],
};

describe('placeholderMessage', () => {
  it('has fixed copy for every stable code', () => {
    for (const code of PLAYER_NODE_ERROR_CODES) {
      expect(placeholderMessage(code).length).toBeGreaterThan(0);
    }
    expect(new Set(PLAYER_NODE_ERROR_CODES.map(placeholderMessage)).size).toBe(
      PLAYER_NODE_ERROR_CODES.length
    );
  });
});

describe('Player per-node error placeholders', () => {
  it('labels each placeholder with its stable code and never shows the thrown message', async () => {
    const onNodeError = vi.fn();
    const { container } = render(Player, {
      props: {
        blueprint: report,
        onNodeError,
        loaders: {
          ...PLAYER_LOADERS,
          'blocks-text': async () => import('./ThrowingComponent.svelte').then((m) => m.default),
        },
      },
    });

    const notes = await screen.findAllByRole('note', { name: '“blocks-text” could not be shown' });
    expect(notes).toHaveLength(2);
    for (const note of notes) {
      expect(note.getAttribute('data-tx-player-error')).toBe('node-error');
      expect(note.textContent).toContain(placeholderMessage('node-error'));
    }
    expect(container.textContent).not.toContain('Simulated component paint failure');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Fictional delivery report' })
    ).toBeTruthy();

    expect(onNodeError).toHaveBeenCalledTimes(2);
    expect(onNodeError.mock.calls.map(([event]) => event.path).sort()).toEqual([
      '0.children.0',
      '0.children.1',
    ]);
    const [first] = onNodeError.mock.calls[0] ?? [];
    expect(first).toMatchObject({ code: 'node-error', id: 'blocks-text', phase: 'render' });
    expect(first.error).toBeInstanceOf(Error);
  });

  it('contains a loader that resolves to a non-component', async () => {
    const onNodeError = vi.fn();
    render(Player, {
      props: {
        blueprint: report,
        onNodeError,
        loaders: { 'layout-doc': layoutLoader, 'blocks-text': async () => ({ default: 'nope' }) },
      },
    });

    const notes = await screen.findAllByRole('note', { name: '“blocks-text” could not be shown' });
    expect(notes).toHaveLength(2);
    expect(onNodeError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'node-error', phase: 'invalid-component' })
    );
  });

  it('reports a rejected load once per node, however often the player repaints', async () => {
    const onNodeError = vi.fn();
    render(Player, {
      props: {
        blueprint: report,
        onNodeError,
        loaders: {
          'layout-doc': layoutLoader,
          'blocks-text': async () => Promise.reject(new Error('offline')),
        },
      },
    });

    expect(
      await screen.findAllByRole('note', { name: '“blocks-text” could not be shown' })
    ).toHaveLength(2);
    expect(onNodeError).toHaveBeenCalledTimes(2);
    expect(onNodeError.mock.calls.every(([event]) => event.phase === 'load')).toBe(true);
  });

  it('explains unknown ids in a preview with their own code', async () => {
    render(Player, {
      props: {
        invalidPolicy: 'preview',
        blueprint: {
          id: 'layout-page',
          props: { title: 'Preview' },
          children: [{ id: 'not-a-real-component', props: {} }],
        },
      },
    });

    const note = await screen.findByRole('note', {
      name: 'Unknown component “not-a-real-component”',
    });
    expect(note.getAttribute('data-tx-player-error')).toBe('unknown-id');
    expect(note.textContent).toContain(placeholderMessage('unknown-id'));
  });
});
