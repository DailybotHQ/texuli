// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/svelte';
import { generateThemeFromSeed } from '@texuli/tokens/generator';
import { describe, expect, it, vi } from 'vitest';
import { parseDeck } from '../src/model/index.ts';
import DeckPrint from '../src/stage/DeckPrint.svelte';

const ocean = generateThemeFromSeed({ seed: '#0e7490', id: 'ocean-test', name: 'Ocean test' });
const ember = generateThemeFromSeed({ seed: '#c2410c', id: 'ember-test', name: 'Ember test' });

function makeDeck() {
  const parsed = parseDeck({
    meta: {
      title: 'Board review',
      aspect: '4:3',
      themeRef: { kind: 'catalog', id: 'ocean-test', mode: 'system' },
    },
    slides: [
      {
        id: 'opening',
        title: 'Opening',
        notes: 'Thank the board.\nKeep it short.',
        blocks: [{ type: 'heading', level: 2, text: 'Three priorities' }],
      },
      {
        id: 'risks',
        title: 'Risks',
        themeRef: { kind: 'catalog', id: 'ember-test', mode: 'dark' },
        blocks: [],
      },
    ],
  });
  if (!parsed.success) throw new Error(parsed.issues[0]?.message);
  return parsed.deck;
}

const loadTheme = vi.fn(async (id: string) => {
  if (id === ocean.id) return ocean;
  if (id === ember.id) return ember;
  throw new Error('unknown');
});

describe('DeckPrint', () => {
  it('renders every slide as a page with its content and themes, then reports ready', async () => {
    const onReady = vi.fn();
    render(DeckPrint, { props: { deck: makeDeck(), loadTheme, onReady } });
    const root = screen.getByRole('document', { name: 'Print: Board review' });
    expect(root.getAttribute('data-print-ready')).toBe('false');

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(root.getAttribute('data-print-ready')).toBe('true');
    expect(onReady.mock.calls[0]?.[0]).toMatchObject({
      filename: 'Board review.pdf',
      pageSize: { aspect: '4:3', pageName: 'tx-deck-4-3' },
    });

    const opening = screen.getByRole('region', { name: 'Slide 1: Opening' });
    const risks = screen.getByRole('region', { name: 'Slide 2: Risks' });
    expect(opening.getAttribute('data-aspect')).toBe('4:3');
    await waitFor(() => expect(opening.textContent).toContain('Three priorities'));
    // System mode prints light; an explicit slide mode holds.
    expect(opening.getAttribute('data-tx-mode')).toBe('light');
    expect(opening.style.getPropertyValue('--tx-background')).toBe(ocean.light.background.default);
    expect(risks.getAttribute('data-tx-mode')).toBe('dark');
    expect(risks.style.getPropertyValue('--tx-background')).toBe(ember.dark.background.default);
    expect(screen.queryByRole('region', { name: /^Notes for/ })).toBeNull();
  });

  it('prints a notes appendix as plain text and a handout without slide bodies', async () => {
    const appendix = render(DeckPrint, {
      props: { deck: makeDeck(), notes: 'appendix', loadTheme: null },
    });
    const notes = screen.getByRole('region', { name: 'Notes for slide 1: Opening' });
    expect(notes.textContent).toContain('Thank the board.\nKeep it short.');
    expect(notes.querySelector('script, [onclick]')).toBeNull();
    expect(screen.getByRole('region', { name: 'Notes for slide 2: Risks' }).textContent).toContain(
      'No notes for this slide.'
    );
    expect(screen.getByRole('region', { name: 'Slide 1: Opening' })).toBeTruthy();
    appendix.unmount();

    render(DeckPrint, { props: { deck: makeDeck(), notes: 'handout', loadTheme: null } });
    expect(screen.queryByRole('region', { name: /^Slide \d/ })).toBeNull();
    expect(screen.getAllByRole('region', { name: /^Notes for/ })).toHaveLength(2);
  });

  it('marks a print-only view for the stylesheet', () => {
    render(DeckPrint, { props: { deck: makeDeck(), printOnly: true, loadTheme: null } });
    expect(
      screen.getByRole('document', { name: 'Print: Board review' }).getAttribute('data-print-only')
    ).toBe('true');
  });
});
