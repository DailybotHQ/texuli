/**
 * `VirtualListView` and the uniform component contract (PLAN_016 T-017-virtual,
 * docs/STANDARDS.md): `bind:ref` is the root, rest attributes and handlers
 * reach the scroller (the listbox or the feed), and caller handlers compose
 * with the component's own. Feed articles are always named, and
 * `surface="plain"` drops the viewport frame. Rows are fictional.
 */
import { cleanup, render } from '@testing-library/svelte';
import { createRawSnippet, flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DATA_MANIFESTS } from '../../catalog/src/manifests/data/index.ts';
import { type ContractCase, checkContract } from '../../primitives/tests/support/contract.ts';
import { createContractRefs } from '../../primitives/tests/support/contract-refs.svelte.ts';
import {
  normalizeVirtualListSurface,
  VIRTUAL_LIST_SURFACES,
  type VirtualListRowContext,
  VirtualListView,
} from '../src/virtual-list/index.ts';
import VirtualListContract from './contract/VirtualListContract.svelte';

type Row = { id: string; label: string };
const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({ id: `r${index}`, label: `Post ${index + 1}` }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const press = (target: Element, key: string): boolean => {
  const result = target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  );
  flushSync();
  return result;
};

// The scroller takes the rest attributes; ref is the root that contains it
// (the split shape of docs/STANDARDS.md), so `class` and `style` frame the
// whole component and `aria-*` names the listbox or feed.
const CASES: ContractCase[] = [
  { key: 'VirtualListView', harness: VirtualListContract, split: true },
  { key: 'VirtualListView', harness: VirtualListContract, split: true, variant: 'feed' },
];

describe('VirtualListView: the uniform component contract', () => {
  for (const c of CASES) {
    it(`${c.variant ?? 'listbox'}: rest attributes, bind:ref and composed handlers`, async () => {
      const result = await checkContract(c, () => createContractRefs(['VirtualListView']));
      expect(result.failures).toEqual([]);
    });
  }

  it('a caller onkeydown that prevents the default skips the listbox keys', () => {
    const onkeydown = vi.fn((event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') event.preventDefault();
    });
    const { container } = render(VirtualListView<Row>, {
      props: { items: rows(5), label: 'Posts', onkeydown },
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
    listbox.focus();
    flushSync();
    expect(listbox.getAttribute('aria-activedescendant')).toMatch(/-option-0$/);
    press(listbox, 'ArrowDown');
    expect(onkeydown).toHaveBeenCalledTimes(1);
    expect(listbox.getAttribute('aria-activedescendant')).toMatch(/-option-0$/);
    press(listbox, 'End');
    expect(listbox.getAttribute('aria-activedescendant')).toMatch(/-option-4$/);
  });

  it('a caller onscroll runs and the window still follows the scroll', () => {
    const onscroll = vi.fn();
    const { container } = render(VirtualListView<Row>, {
      props: { items: rows(1000), label: 'Posts', onscroll },
    });
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
    listbox.scrollTop = 4000;
    listbox.dispatchEvent(new Event('scroll'));
    flushSync();
    expect(onscroll).toHaveBeenCalledTimes(1);
    const first = container.querySelector('[role="option"]') as HTMLElement;
    expect(Number(first.dataset.index)).toBeGreaterThan(50);
  });

  it('class, style and ref frame the root; id names the scroller and its rows', () => {
    let ref: HTMLElement | null = null;
    const { container } = render(VirtualListView<Row>, {
      props: {
        items: rows(3),
        label: 'Posts',
        id: 'team-posts',
        class: 'host-list',
        style: 'max-inline-size: 30rem',
        'aria-describedby': 'posts-help',
        get ref() {
          return ref;
        },
        set ref(value) {
          ref = value;
        },
      },
    });
    const root = container.querySelector('[data-tx-component="data-virtual-list"]');
    expect(ref).toBe(root);
    expect(root?.classList.contains('host-list')).toBe(true);
    expect(root?.getAttribute('style')).toContain('max-inline-size');
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
    expect(listbox.id).toBe('team-posts');
    expect(listbox.getAttribute('aria-describedby')).toBe('posts-help');
    expect(container.querySelector('#team-posts-option-0')).not.toBeNull();
  });
});

/** A feed card; `heading` picks how the snippet names its article. */
const card = (heading: 'labelId' | 'own' | 'heading' | 'none') =>
  createRawSnippet<[VirtualListRowContext<Row>]>((context) => ({
    render: () => {
      const { item, labelId } = context();
      const title =
        heading === 'labelId'
          ? `<h3 id="${labelId}">${item.label}</h3>`
          : heading === 'own'
            ? `<h3 id="post-${item.id}">${item.label}</h3>`
            : heading === 'heading'
              ? `<h3 id="h-${item.id}">${item.label}</h3>`
              : `<p>${item.label}</p>`;
      return `<div class="card">${title}<button type="button">Like</button></div>`;
    },
  }));

const nameOf = (article: Element): string | null => {
  const ids = article.getAttribute('aria-labelledby');
  if (ids) return article.ownerDocument.getElementById(ids)?.textContent ?? null;
  return article.getAttribute('aria-label');
};

describe('feed mode: every article is named', () => {
  it('by the labelId the row snippet puts on its heading', () => {
    const { container } = render(VirtualListView<Row>, {
      props: { items: rows(3), label: 'Team feed', mode: 'feed', row: card('labelId') },
    });
    const articles = [...container.querySelectorAll('article')];
    expect(articles).toHaveLength(3);
    articles.forEach((article, index) => {
      expect(article.getAttribute('aria-labelledby')).toMatch(/-label$/);
      expect(article.hasAttribute('aria-label')).toBe(false);
      expect(nameOf(article)).toBe(`Post ${index + 1}`);
    });
  });

  it('by the id getRowLabelId returns', () => {
    const { container } = render(VirtualListView<Row>, {
      props: {
        items: rows(2),
        label: 'Team feed',
        mode: 'feed',
        row: card('own'),
        getRowLabelId: (item: Row) => `post-${item.id}`,
      },
    });
    const article = container.querySelector('article') as HTMLElement;
    expect(article.getAttribute('aria-labelledby')).toBe('post-r0');
    expect(nameOf(article)).toBe('Post 1');
  });

  it('by the first heading with an id, else by aria-label: never a missing id', () => {
    const { container } = render(VirtualListView<Row>, {
      props: { items: rows(2), label: 'Team feed', mode: 'feed', row: card('heading') },
    });
    const article = container.querySelector('article') as HTMLElement;
    expect(article.getAttribute('aria-labelledby')).toBe('h-r0');
    cleanup();

    const plain = render(VirtualListView<Row>, {
      props: { items: rows(2), label: 'Team feed', mode: 'feed', row: card('none') },
    });
    const unnamed = plain.container.querySelector('article') as HTMLElement;
    expect(unnamed.hasAttribute('aria-labelledby')).toBe(false);
    expect(unnamed.getAttribute('aria-label')).toBe('Post 1');
  });

  it('without a row snippet, by its label; listbox options are unchanged', () => {
    const { container } = render(VirtualListView<Row>, {
      props: { items: rows(2), label: 'Team feed', mode: 'feed' },
    });
    const article = container.querySelector('article') as HTMLElement;
    expect(nameOf(article)).toBe('Post 1');
    cleanup();
    const listbox = render(VirtualListView<Row>, { props: { items: rows(2), label: 'Posts' } });
    const option = listbox.container.querySelector('[role="option"]') as HTMLElement;
    expect(option.hasAttribute('aria-labelledby')).toBe(false);
    expect(option.hasAttribute('aria-label')).toBe(false);
  });
});

describe('surface', () => {
  it('plain drops the viewport frame; box is the default', () => {
    const boxed = render(VirtualListView<Row>, { props: { items: rows(2), label: 'Posts' } });
    const root = boxed.container.querySelector('.tx-virtual-list') as HTMLElement;
    expect(root.dataset.txSurface).toBe('box');
    expect(root.classList.contains('tx-virtual-list--plain')).toBe(false);
    cleanup();
    const plain = render(VirtualListView<Row>, {
      props: { items: rows(2), label: 'Team feed', mode: 'feed', surface: 'plain' },
    });
    const plainRoot = plain.container.querySelector('.tx-virtual-list') as HTMLElement;
    expect(plainRoot.dataset.txSurface).toBe('plain');
    expect(plainRoot.classList.contains('tx-virtual-list--plain')).toBe(true);
    expect(normalizeVirtualListSurface('glass')).toBe('box');
  });

  it('the catalog lists surface with the component values (spec 0.15.0)', () => {
    const manifest = DATA_MANIFESTS.find((entry) => entry.id === 'data-virtual-list');
    const surface = manifest?.props?.find((prop) => prop.name === 'surface');
    expect(surface).toMatchObject({ kind: 'enum', default: 'box' });
    expect(surface?.enumValues).toEqual([...VIRTUAL_LIST_SURFACES]);
  });
});
