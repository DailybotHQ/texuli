import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildToc,
  normalizeTocEntries,
  resolveTocLevels,
  trackActiveHeading,
} from '../src/layouts/content/index.ts';
import ContentLayoutDirectHarness from './fixtures/ContentLayoutDirectHarness.svelte';
import ContentLayoutTrackingHarness from './fixtures/ContentLayoutTrackingHarness.svelte';

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

describe('layouts-content: active heading tracking (G52)', () => {
  /** A stand-in IntersectionObserver: records its options and targets; `fire()` runs the callback. */
  class FakeObserver {
    static instances: FakeObserver[] = [];
    readonly targets = new Set<Element>();
    readonly callback: IntersectionObserverCallback;
    readonly options: IntersectionObserverInit | undefined;
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback;
      this.options = options;
      FakeObserver.instances.push(this);
    }
    observe(target: Element) {
      this.targets.add(target);
    }
    unobserve(target: Element) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
    }
    takeRecords() {
      return [];
    }
    fire() {
      this.callback([], this as unknown as IntersectionObserver);
    }
  }
  const tops: Record<string, number> = {};
  const scrollTo = (positions: Record<string, number>) => {
    Object.assign(tops, positions);
    for (const observer of FakeObserver.instances) observer.fire();
  };
  const current = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.tx-content-layout__toc a[aria-current]')).map(
      (link) => [link.textContent?.trim(), link.getAttribute('aria-current')]
    );

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeObserver.instances = [];
  });

  it('marks the heading being read with aria-current="location", reports it and binds activeId, for scanned and host entries', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      return { top: tops[this.id] ?? 10_000 } as DOMRect;
    });
    for (const toc of [
      undefined,
      [
        { id: 'two', label: 'Second part', level: 2 as const },
        { id: 'three', label: 'Third part', level: 3 as const },
      ],
    ]) {
      const changes: Array<[string, string | undefined]> = [];
      const view = render(ContentLayoutTrackingHarness, {
        props: {
          toc,
          onChange: (id: string, item?: { label: string }) => changes.push([id, item?.label]),
        },
      });
      const first = toc ? 'Second part' : 'One';
      await waitFor(() => expect(current(view.container)).toEqual([[first, 'location']]));
      const observer = FakeObserver.instances.at(-1) as FakeObserver;
      // The reading band is the top 30% of the viewport, and every listed heading is watched.
      expect(observer.options?.rootMargin).toBe('0px 0px -70% 0px');
      expect([...observer.targets].map((target) => target.id)).toEqual(
        toc ? ['two', 'three'] : ['one', 'two', 'three']
      );
      // Scrolling down: "three" passes the reading line (30% of 768 px).
      scrollTo({ one: -900, two: -300, three: 120 });
      await waitFor(() =>
        expect(current(view.container)).toEqual([[toc ? 'Third part' : 'Three', 'location']])
      );
      expect(view.getByTestId('active').textContent).toBe('three');
      // Scrolling back up: "two" is the last heading above the line.
      scrollTo({ one: -200, two: 100, three: 600 });
      await waitFor(() => expect(view.getByTestId('active').textContent).toBe('two'));
      // Above every heading, the first entry is current.
      scrollTo({ one: 400, two: 900, three: 1_400 });
      await waitFor(() => expect(view.getByTestId('active').textContent).toBe(toc ? 'two' : 'one'));
      expect(changes).toEqual(
        toc
          ? [
              ['two', 'Second part'],
              ['three', 'Third part'],
              ['two', 'Second part'],
            ]
          : [
              ['one', 'One'],
              ['three', 'Three'],
              ['two', 'Two'],
              ['one', 'One'],
            ]
      );
      view.unmount();
      for (const key of Object.keys(tops)) delete tops[key];
    }
  });

  it('tracks headings on its own outside ContentLayout (G102): reading line, onChange, dispose', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      return { top: tops[this.id] ?? 10_000 } as DOMRect;
    });
    const container = document.createElement('article');
    for (const id of ['a', 'b', 'c']) {
      const heading = document.createElement('h2');
      heading.id = id;
      heading.textContent = id.toUpperCase();
      container.append(heading);
    }
    document.body.append(container);
    const changes: Array<[string, string | undefined]> = [];
    // Host entries by id, or as strings; an id with no element is skipped.
    const dispose = trackActiveHeading(container, ['a', { id: 'b' }, { id: 'missing' }, 'c'], {
      readingLine: 0.5,
      onChange: (id, element) => changes.push([id, element?.textContent ?? undefined]),
    });
    const observer = FakeObserver.instances.at(-1) as FakeObserver;
    expect(observer.options?.rootMargin).toBe('0px 0px -50% 0px');
    expect([...observer.targets].map((target) => target.id)).toEqual(['a', 'b', 'c']);
    // 50% of 768 px is 384: "b" passed it, "c" did not.
    scrollTo({ a: -500, b: 300, c: 500 });
    // The same heading again reports nothing.
    scrollTo({ a: -520, b: 280, c: 480 });
    scrollTo({ a: -900, b: -100, c: 100 });
    expect(changes).toEqual([
      ['b', 'B'],
      ['c', 'C'],
    ]);
    dispose();
    expect(observer.targets.size).toBe(0);
    // A disposed tracker never reports again, even if its observer fires late.
    scrollTo({ a: 10, b: 900, c: 1_400 });
    expect(changes).toHaveLength(2);
    dispose();
    container.remove();
  });

  it('is a no-op without an observer or a window (server rendering), and disposes cleanly', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onChange = vi.fn();
    const container = document.createElement('div');
    const heading = document.createElement('h2');
    heading.id = 'x';
    container.append(heading);
    const dispose = trackActiveHeading(container, ['x'], { onChange });
    expect(onChange).not.toHaveBeenCalled();
    expect(() => dispose()).not.toThrow();
  });

  it('honors a bound activeId and needs no observer (server rendering, old browsers)', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const view = render(ContentLayoutTrackingHarness, { props: { initial: 'two' } });
    await waitFor(() => expect(current(view.container)).toEqual([['Two', 'location']]));
    expect(view.getByTestId('active').textContent).toBe('two');
  });
});
