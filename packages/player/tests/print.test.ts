/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet, tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Player from '../src/Player.svelte';

const blueprint = {
  id: 'layout-doc',
  props: { title: 'Fictional delivery report' },
  children: [
    { id: 'blocks-text', props: { block: { type: 'heading', level: 2, text: 'Weekly summary' } } },
    {
      id: 'blocks-text',
      props: { block: { type: 'text', markdown: 'All sample work is on track.' } },
    },
  ],
};

const composer = createRawSnippet(() => ({ render: () => '<p>Ask a follow-up</p>' }));

function surfaceOf(root: HTMLElement): HTMLElement {
  return root.querySelector('[data-tx-player-surface]') as HTMLElement;
}

describe('Player print mode (ADR-016)', () => {
  afterEach(cleanup);

  it('paints a static, printable form with the print prop', async () => {
    const view = render(Player, { props: { blueprint, print: true, composer } });
    await screen.findByRole('heading', { level: 2, name: 'Weekly summary' });
    const root = view.container.querySelector('[data-tx-player]') as HTMLElement;
    expect(root.hasAttribute('data-tx-player-print')).toBe(true);
    expect(root.getAttribute('data-tx-motion')).toBe('reduce');
    expect(surfaceOf(root).hasAttribute('inert')).toBe(true);
    // Interactive chrome stays out of print: no skip link, end anchor or composer.
    expect(root.querySelector('.tx-player__skip')).toBeNull();
    expect(root.querySelector('.tx-player__end')).toBeNull();
    expect(screen.queryByText('Ask a follow-up')).toBeNull();
    // What the page says stays: the label, the trust badge and the content.
    expect(screen.getByRole('heading', { level: 2, name: 'Blueprint preview' })).toBeTruthy();
    expect(screen.getByText('All sample work is on track.')).toBeTruthy();
  });

  it('enters print mode between beforeprint and afterprint, and leaves it after', async () => {
    const view = render(Player, { props: { blueprint, composer } });
    await screen.findByRole('heading', { level: 2, name: 'Weekly summary' });
    const root = view.container.querySelector('[data-tx-player]') as HTMLElement;
    expect(root.hasAttribute('data-tx-player-print')).toBe(false);
    expect(surfaceOf(root).hasAttribute('inert')).toBe(false);
    expect(screen.getByText('Ask a follow-up')).toBeTruthy();
    window.dispatchEvent(new Event('beforeprint'));
    await tick();
    expect(root.hasAttribute('data-tx-player-print')).toBe(true);
    expect(surfaceOf(root).hasAttribute('inert')).toBe(true);
    expect(screen.queryByText('Ask a follow-up')).toBeNull();
    window.dispatchEvent(new Event('afterprint'));
    await tick();
    expect(root.hasAttribute('data-tx-player-print')).toBe(false);
    expect(surfaceOf(root).hasAttribute('inert')).toBe(false);
    expect(screen.getByText('Ask a follow-up')).toBeTruthy();
  });

  it('ships print styles: page breaks, hidden controls, no dimmed surface', () => {
    const css = readFileSync('packages/player/src/player.css', 'utf8');
    const media = css.slice(css.indexOf('@media print'));
    expect(media).toContain('break-inside: avoid');
    expect(media).toContain('break-after: avoid');
    expect(media).toContain('print-color-adjust: exact');
    expect(css).toContain('.tx-player[data-tx-player-print] .tx-player__surface[inert]');
    const docs = readFileSync('packages/player/docs/embedding.md', 'utf8');
    expect(docs).toContain('| `print` |');
  });
});
