/**
 * `VirtualListView` with rows that hold their own controls (T-0161-virtual-feed, found by a
 * fictional host's feed): keys act only on the element that owns them, so Space in a row's
 * input and Enter on a row's button reach that control; `mode="feed"` is the APG feed pattern
 * (articles with aria-setsize/aria-posinset, Page Down / Page Up between articles, no
 * selection); `selectable={false}` keeps a listbox from selecting; feeds and non-selectable
 * lists use a plain row without option chrome.
 */
import { cleanup, render } from '@testing-library/svelte';
import { createRawSnippet, flushSync, tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeVirtualListMode,
  VIRTUAL_LIST_MODES,
  type VirtualListRowContext,
  VirtualListView,
} from '../src/virtual-list/index.ts';

type Row = { id: string; label: string };
const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({ id: `r${index}`, label: `Post ${index + 1}` }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A card row with its own button and input, like a feed post with a reply field. */
const cardRow = (onLike: (index: number) => void) =>
  createRawSnippet<[VirtualListRowContext<Row>]>((context) => ({
    render: () =>
      `<div class="card"><p>${context().item.label}</p><button type="button">Like</button><input aria-label="Reply to ${context().item.label}" /></div>`,
    setup: (element) => {
      element.querySelector('button')?.addEventListener('click', () => onLike(context().index));
    },
  }));

/** Dispatch a keydown; false when a handler called preventDefault (the key was taken). */
const press = (target: Element, key: string): boolean => {
  const result = target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  );
  flushSync();
  return result;
};
const click = (target: Element): void => {
  (target as HTMLElement).click();
  flushSync();
};

const NESTED_INTERACTIVE = '[role="option"] button, [role="option"] input, [role="option"] a';
const articles = (container: HTMLElement) =>
  [...container.querySelectorAll('article')] as HTMLElement[];

describe('listbox mode: a key in a row control belongs to that control', () => {
  it('Space in a row input and Enter on a row button are not taken by the listbox', () => {
    const onSelect = vi.fn();
    const { container } = render(VirtualListView<Row>, {
      props: { items: rows(20), label: 'Posts', onSelect, row: cardRow(() => {}) },
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
    const input = container.querySelector('input') as HTMLInputElement;
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(press(input, ' ')).toBe(true);
    expect(press(button, 'Enter')).toBe(true);
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'])
      expect(press(input, key)).toBe(true);
    flushSync();
    expect(onSelect).not.toHaveBeenCalled();
    expect(listbox.getAttribute('aria-activedescendant')).toBeNull();
    // The listbox still owns its own keys.
    listbox.focus();
    flushSync();
    expect(press(listbox, 'ArrowDown')).toBe(false);
    expect(press(listbox, 'Enter')).toBe(false);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('selectable={false}: no selection is written or painted; onSelect still fires', () => {
    const onSelect = vi.fn();
    const { container } = render(VirtualListView<Row>, {
      props: { items: rows(5), label: 'Posts', selectable: false, onSelect },
    });
    const first = container.querySelector('[role="option"]') as HTMLElement;
    click(first);
    flushSync();
    expect(onSelect).toHaveBeenCalledWith({ id: 'r0', label: 'Post 1' }, 0);
    expect(container.querySelector('[aria-selected="true"]')).toBeNull();
    expect(first.classList.contains('tx-virtual-list__row')).toBe(true);
    expect(first.classList.contains('tx-virtual-list__option')).toBe(false);
  });

  it('the default listbox is unchanged: option chrome and selection paint', () => {
    const { container } = render(VirtualListView<Row>, {
      props: { items: rows(5), label: 'Posts' },
    });
    const first = container.querySelector('[role="option"]') as HTMLElement;
    expect(first.classList.contains('tx-virtual-list__option')).toBe(true);
    click(first);
    flushSync();
    expect(first.getAttribute('aria-selected')).toBe('true');
  });
});

describe('feed mode (APG feed)', () => {
  it('is a feed of articles with their position, and no listbox or option roles', () => {
    const { container } = render(VirtualListView<Row>, {
      props: { items: rows(10_000), label: 'Team feed', mode: 'feed', row: cardRow(() => {}) },
    });
    const feed = container.querySelector('[role="feed"]') as HTMLElement;
    expect(feed.getAttribute('aria-label')).toBe('Team feed');
    expect(feed.hasAttribute('tabindex')).toBe(false);
    // axe nested-interactive: controls sit in articles, never in an option or a listbox.
    expect(container.querySelector('[role="listbox"], [role="option"]')).toBeNull();
    expect(container.querySelectorAll(NESTED_INTERACTIVE)).toHaveLength(0);
    const list = articles(container);
    expect(list.length).toBe(13);
    list.forEach((article, index) => {
      expect(article.getAttribute('role')).toBeNull();
      expect(article.getAttribute('aria-setsize')).toBe('10000');
      expect(article.getAttribute('aria-posinset')).toBe(String(index + 1));
      expect(article.hasAttribute('aria-selected')).toBe(false);
      expect(article.classList.contains('tx-virtual-list__row')).toBe(true);
    });
    // One tab stop; every other article is focusable by script.
    expect(list.filter((article) => article.tabIndex === 0)).toHaveLength(1);
    expect(list.every((article) => article.tabIndex <= 0)).toBe(true);
  });

  it('names an article by its label when no row snippet is given', () => {
    const { container } = render(VirtualListView<Row>, {
      props: { items: rows(3), label: 'Team feed', mode: 'feed' },
    });
    const article = articles(container)[1] as HTMLElement;
    const label = container.querySelector(`#${article.getAttribute('aria-labelledby')}`);
    expect(label?.textContent).toBe('Post 2');
  });

  it('rows with a button and an input keep Space and Enter; clicks never select', () => {
    const onSelect = vi.fn();
    const onLike = vi.fn();
    const { container } = render(VirtualListView<Row>, {
      props: { items: rows(20), label: 'Team feed', mode: 'feed', onSelect, row: cardRow(onLike) },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(press(input, ' ')).toBe(true);
    expect(press(input, 'PageDown')).toBe(true);
    expect(press(button, 'Enter')).toBe(true);
    click(button);
    click(articles(container)[2] as HTMLElement);
    flushSync();
    expect(onLike).toHaveBeenCalledWith(0);
    expect(onSelect).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-selected]')).toBeNull();
  });

  it('Page Down moves focus to the next article and Page Up back, even past the window', async () => {
    const { container } = render(VirtualListView<Row>, {
      props: { items: rows(10_000), label: 'Team feed', mode: 'feed', row: cardRow(() => {}) },
    });
    const first = articles(container)[0] as HTMLElement;
    first.focus();
    expect(press(first, 'PageDown')).toBe(false);
    await tick();
    await tick();
    expect(document.activeElement?.getAttribute('aria-posinset')).toBe('2');
    // Focus moved the tab stop with it.
    expect((document.activeElement as HTMLElement).tabIndex).toBe(0);
    press(document.activeElement as HTMLElement, 'PageUp');
    await tick();
    await tick();
    expect(document.activeElement).toBe(first);

    // The last rendered article: the next one is scrolled into the window, then focused.
    const last = articles(container).at(-1) as HTMLElement;
    const position = Number(last.getAttribute('aria-posinset'));
    last.focus();
    press(last, 'PageDown');
    await tick();
    await tick();
    expect(document.activeElement?.getAttribute('aria-posinset')).toBe(String(position + 1));
  });
});

describe('mode values', () => {
  it('normalizes an unknown mode to listbox', () => {
    expect(normalizeVirtualListMode('feed')).toBe('feed');
    expect(normalizeVirtualListMode('grid')).toBe('listbox');
    expect(normalizeVirtualListMode(undefined)).toBe('listbox');
    expect([...VIRTUAL_LIST_MODES]).toEqual(['listbox', 'feed']);
  });
});
