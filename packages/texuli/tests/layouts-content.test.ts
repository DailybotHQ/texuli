import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { buildToc, normalizeTocEntries, resolveTocLevels } from '../src/layouts/content/index.ts';
import ContentLayoutDirectHarness from './fixtures/ContentLayoutDirectHarness.svelte';

// G39: ContentLayout takes declarative content, chooses its heading levels,
// keeps authored heading ids on request and accepts host-supplied TOC entries.

function tocLinks(container: HTMLElement): Array<[string, string | null]> {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>('.tx-content-layout__toc a')).map(
    (link) => [link.textContent?.trim() ?? '', link.getAttribute('href')]
  );
}

function headingIds(container: HTMLElement): Array<string | null> {
  return Array.from(
    container.querySelectorAll<HTMLElement>('.tx-content-layout__main :is(h2, h3, h4)')
  ).map((heading) => heading.getAttribute('id'));
}

const AUTHORED_IDS = ['intro', null, 'setup', 'callout-note', 'deep-detail', 'intro'];

describe('layouts-content: ContentLayout TOC control (G39)', () => {
  afterEach(() => cleanup());

  it('normalizes heading levels from props or the options string', () => {
    const cases: Array<[unknown, number[]]> = [
      [undefined, [2, 3]],
      [
        [4, 2, 2, 9, 1],
        [2, 4],
      ],
      ['2, 4,6', [2, 4, 6]],
      ['', [2, 3]],
      [[], [2, 3]],
      ['h2', [2, 3]],
    ];
    for (const [input, expected] of cases) {
      expect(resolveTocLevels(input), String(input)).toEqual(expected);
    }
  });

  it('keeps authored ids, drops id-less and duplicate headings when ids are preserved', () => {
    expect(
      buildToc(
        [
          { id: 'intro', text: 'Introduction', level: 2 },
          { text: 'No id', level: 2 },
          { id: 'intro', text: 'Again', level: 2 },
          { id: 'deep', text: 'Deep', level: 4 },
        ],
        { preserveIds: true }
      )
    ).toEqual([
      { id: 'intro', label: 'Introduction', level: 2 },
      { id: 'deep', label: 'Deep', level: 4 },
    ]);
    expect(
      normalizeTocEntries([
        { id: 'a', label: ' A ', level: 2 },
        { id: 'a', label: 'Duplicate', level: 2 },
        { id: ' ', label: 'Blank id', level: 2 },
        { id: 'b', label: '   ', level: 3 },
        { id: 'c', label: 'C', level: 7 as 2 },
      ])
    ).toEqual([
      { id: 'a', label: 'A', level: 2 },
      { id: 'c', label: 'C', level: 2 },
    ]);
  });

  it('renders declarative children without mountScreen and builds the default h2/h3 TOC', async () => {
    const view = render(ContentLayoutDirectHarness);
    const main = view.container.querySelector<HTMLElement>('.tx-content-layout__main');
    expect(main?.querySelector('#setup')?.textContent).toBe('Setup');
    await waitFor(() => expect(tocLinks(view.container).length).toBeGreaterThan(0));
    expect(tocLinks(view.container)).toEqual([
      ['Introduction', '#intro'],
      ['Untitled section', '#untitled-section'],
      ['Setup', '#setup'],
      ['Callout note', '#callout-note'],
      ['Introduction again', '#intro-2'],
    ]);
  });

  it('chooses heading levels through tocLevels and the options fallback', async () => {
    const cases: Array<[Record<string, unknown>, string[]]> = [
      [{ tocLevels: [2] }, ['Introduction', 'Untitled section', 'Introduction again']],
      [
        { tocLevels: [2, 3, 4] },
        [
          'Introduction',
          'Untitled section',
          'Setup',
          'Callout note',
          'Deep detail',
          'Introduction again',
        ],
      ],
      [{ options: { tocLevels: '3,4' } }, ['Setup', 'Callout note', 'Deep detail']],
    ];
    for (const [props, expected] of cases) {
      const view = render(ContentLayoutDirectHarness, { props });
      await waitFor(() =>
        expect(
          tocLinks(view.container).map(([label]) => label),
          JSON.stringify(props)
        ).toEqual(expected)
      );
      const levels = Array.from(
        view.container.querySelectorAll<HTMLElement>('.tx-content-layout__toc li')
      ).map((item) => item.dataset.level);
      expect(levels.every((level) => Boolean(level))).toBe(true);
      view.unmount();
    }
  });

  it('never rewrites heading ids when preserveHeadingIds is set (prop or option)', async () => {
    for (const props of [{ preserveHeadingIds: true }, { options: { preserveHeadingIds: true } }]) {
      const view = render(ContentLayoutDirectHarness, { props });
      await waitFor(() => expect(tocLinks(view.container).length).toBeGreaterThan(0));
      expect(headingIds(view.container), JSON.stringify(props)).toEqual(AUTHORED_IDS);
      expect(tocLinks(view.container)).toEqual([
        ['Introduction', '#intro'],
        ['Setup', '#setup'],
        ['Callout note', '#callout-note'],
      ]);
      view.unmount();
    }
  });

  it('renders host TOC entries as given and leaves every heading untouched', async () => {
    const view = render(ContentLayoutDirectHarness, {
      props: {
        toc: [
          { id: 'intro', label: 'Start', level: 2 },
          { id: 'deep-detail', label: 'Details', level: 4 },
          { id: 'intro', label: 'Duplicate dropped', level: 2 },
        ],
      },
    });
    await waitFor(() =>
      expect(tocLinks(view.container)).toEqual([
        ['Start', '#intro'],
        ['Details', '#deep-detail'],
      ])
    );
    expect(headingIds(view.container)).toEqual(AUTHORED_IDS);
    expect(view.container.querySelector('[data-tx-content-heading]')).toBeNull();
    expect(
      view.container
        .querySelector('.tx-content-layout__toc li:last-child')
        ?.getAttribute('data-level')
    ).toBe('4');
    expect(
      view.container.querySelector('.tx-content-layout__toc a')?.getAttribute('aria-current')
    ).toBe('location');
  });

  it('still mounts imperative content through mountScreen next to children', async () => {
    const view = render(ContentLayoutDirectHarness, {
      props: {
        mountScreen: (target: HTMLElement) => {
          const heading = target.ownerDocument.createElement('h2');
          heading.textContent = 'Mounted section';
          target.append(heading);
        },
      },
    });
    await waitFor(() =>
      expect(tocLinks(view.container).map(([label]) => label)).toContain('Mounted section')
    );
  });
});
