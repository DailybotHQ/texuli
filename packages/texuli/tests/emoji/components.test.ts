import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSanitizedEmojiSvg } from '../../src/emoji/art.ts';
import Emoji from '../../src/emoji/Emoji.svelte';
import EmojiPicker from '../../src/emoji/EmojiPicker.svelte';
import EmojiText from '../../src/emoji/EmojiText.svelte';

afterEach(cleanup);

describe('Emoji', () => {
  it('uses the CLDR name and renders Unicode by default', () => {
    render(Emoji, { props: { id: '1f680' } });
    return screen.findByRole('img', { name: 'rocket' }).then((emoji) => {
      expect(emoji.textContent).toBe('🚀');
    });
  });

  it('keeps decorative emoji out of the accessibility tree', () => {
    const { container } = render(Emoji, { props: { id: '1f680', decorative: true } });
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toContain('🚀');
  });

  it('refuses unsafe image URLs and only renders constrained path SVG records', () => {
    const image = render(Emoji, {
      props: { id: '1f680', artResolver: () => ({ kind: 'image', src: 'javascript:alert(1)' }) },
    });
    expect(image.container.querySelector('img')).toBeNull();
    expect(image.container.textContent).toContain('🚀');
    cleanup();

    const svg = {
      viewBox: '0 0 64 64',
      paths: [{ d: 'M2 2L3 3Z', fill: '#123abc' }],
    } as const;
    expect(isSanitizedEmojiSvg(svg)).toBe(true);
    expect(
      isSanitizedEmojiSvg({ ...svg, paths: [{ d: 'M2 2" onload="x', fill: '#123abc' }] })
    ).toBe(false);
    const tree = render(Emoji, {
      props: { id: '1f680', artResolver: () => ({ kind: 'svg', svg }) },
    });
    expect(tree.container.querySelector('svg path')?.getAttribute('d')).toBe('M2 2L3 3Z');
  });
});

describe('EmojiText', () => {
  it('renders shortcode and Unicode tokens as text nodes without parsing markup', () => {
    const { container } = render(EmojiText, {
      props: { text: '<img src=x onerror=alert(1)> :rocket: 👋' },
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.textContent).toContain('🚀');
    expect(container.textContent).toContain('👋');
  });
});

describe('EmojiPicker', () => {
  it('loads the catalog on demand and supports grid navigation and host-owned recents', async () => {
    const onSelect = vi.fn();
    const onRecentIdsChange = vi.fn();
    const view = render(EmojiPicker, {
      props: { id: 'test-emoji-picker', onSelect, onRecentIdsChange, pageSize: 80 },
    });
    const grid = await screen.findByRole('grid', { name: 'All' });
    await screen.findByRole('gridcell', { name: 'grinning face' });
    grid.focus();
    const first = grid.getAttribute('aria-activedescendant');
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    await waitFor(() => expect(grid.getAttribute('aria-activedescendant')).not.toBe(first));
    fireEvent.keyDown(grid, { key: 'Home' });
    await waitFor(() => expect(grid.getAttribute('aria-activedescendant')).toBe(first));
    fireEvent.keyDown(grid, { key: 'PageDown' });
    await waitFor(() => expect(grid.getAttribute('aria-activedescendant')).not.toBe(first));
    fireEvent.keyDown(grid, { key: 'r' });
    const search = screen.getByRole('combobox', { name: 'Search emoji' }) as HTMLInputElement;
    await waitFor(() => expect(search.value).toBe('r'));

    const recentTab = screen.getByRole('option', { name: 'Recent' });
    fireEvent.click(recentTab);
    expect(await screen.findByText('No emoji found.')).toBeTruthy();
    fireEvent.input(search, { target: { value: '' } });
    fireEvent.click(screen.getByRole('option', { name: 'All' }));
    const firstEmoji = await screen.findByRole('gridcell', { name: 'grinning face' });
    fireEvent.click(firstEmoji);
    expect(onSelect).toHaveBeenCalledWith({
      id: '1f600',
      unicode: '😀',
      shortcode: ':grinning_face:',
    });
    expect(onRecentIdsChange).toHaveBeenCalledWith(['1f600']);
    view.rerender({ recentIds: ['1f600'], onSelect, onRecentIdsChange, pageSize: 80 });
    fireEvent.click(screen.getByRole('option', { name: 'Recent' }));
    expect(await screen.findByRole('gridcell', { name: 'grinning face' })).toBeTruthy();
  });

  it('applies a selected tone without duplicating each base emoji', async () => {
    render(EmojiPicker, { props: { id: 'tone-test-picker', pageSize: 120 } });
    const search = screen.getByRole('combobox', { name: 'Search emoji' });
    fireEvent.click(screen.getByRole('option', { name: 'People' }));
    fireEvent.input(search, { target: { value: 'waving hand' } });
    const baseMatches = await screen.findAllByRole('gridcell');
    const baseCount = baseMatches.length;
    fireEvent.click(screen.getByRole('radio', { name: 'Medium skin tone' }));
    const matches = await screen.findAllByRole('gridcell');
    const labels = matches.map((item) => item.getAttribute('aria-label') ?? '');
    expect(matches).toHaveLength(baseCount);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.some((name) => name.includes('medium skin tone'))).toBe(true);
  });
});
