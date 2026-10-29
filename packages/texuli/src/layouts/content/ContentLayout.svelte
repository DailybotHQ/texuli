<script lang="ts">
import { getOwnerWindow } from '@texuli/core/env';
import { safeHref } from '@texuli/core/url-policy';
import { untrack } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import LayoutChrome from '../host/LayoutChrome.svelte';
import { isNavPathActive } from '../host/nav-model.ts';
import { isNestedInMain } from '../host/nested-main.ts';
import {
  buildToc,
  normalizeTocEntries,
  resolveTocLevels,
  type TocEntry,
  type TocItem,
  type TocLevel,
  tocSelector,
} from './toc.ts';
import './content.css';

type Kind = 'docs' | 'blog' | 'editorial';
type Props = {
  kind: Kind;
  /**
   * Imperative mount (the layout-host contract): called once with the
   * content element. Optional when the content comes as `children`.
   */
  mountScreen?: (target: HTMLElement) => void;
  /** Declarative article content, rendered inside the content region. */
  children?: import('svelte').Snippet;
  /**
   * Host-supplied table of contents. When set, the layout lists exactly these
   * entries (blank and repeated ids dropped) and never scans, renames or marks
   * a heading; each `id` names an element already on the page.
   */
  toc?: readonly TocEntry[];
  /**
   * Heading levels the scanned table of contents lists (default `[2, 3]`).
   * Also read from `options.tocLevels` as a comma list (`"2,3,4"`).
   */
  tocLevels?: readonly TocLevel[];
  /**
   * Keep authored heading ids exactly as written: the layout never assigns or
   * changes an id, and id-less or repeated-id headings stay out of the table
   * of contents. Also read from `options.preserveHeadingIds`.
   */
  preserveHeadingIds?: boolean;
  /**
   * The id of the heading being read (`bind:activeId`): its table of contents
   * link gets `aria-current="location"`. The layout tracks it while the page
   * scrolls (the last listed heading above the top 30% of the viewport) once
   * it runs in a browser; on the server it is this value, else the first
   * entry.
   */
  activeId?: string;
  /** The active heading changed while reading (scroll, content changes). */
  onActiveHeadingChange?: (id: string, item: TocItem | undefined) => void;
  nav?: import('../host/nav-model.ts').NavModel;
  path?: string;
  options?: import('../host/contract.ts').LayoutOptions;
  storageKey?: string;
  aside?: import('svelte').Snippet;
  class?: ClassValue;
};

let {
  kind,
  mountScreen,
  children,
  toc,
  tocLevels,
  preserveHeadingIds,
  activeId = $bindable(''),
  onActiveHeadingChange,
  nav,
  path,
  options,
  class: className,
}: Props = $props();
let screenTarget = $state<HTMLElement>();
let scannedItems = $state<TocItem[]>([]);
const instanceId = $props.id();
let root = $state<HTMLElement | undefined>();
let nested = $state(false);
$effect(() => {
  nested = isNestedInMain(root);
});
const mainId = `tx-content-main-${instanceId}`;
const titleId = `${mainId}-title`;

const title = $derived(textOption('title') ?? defaultTitle(kind));
const summary = $derived(textOption('summary'));
const eyebrow = $derived(textOption('eyebrow'));
const author = $derived(textOption('author'));
const date = $derived(textOption('date'));
const readingTime = $derived(textOption('readingTime'));
const levels = $derived(resolveTocLevels(tocLevels ?? options?.tocLevels));
const keepIds = $derived(preserveHeadingIds ?? options?.preserveHeadingIds === true);
const providedItems = $derived(toc ? normalizeTocEntries(toc) : undefined);
const tocItems = $derived(providedItems ?? scannedItems);
/** Before tracking starts (server rendering), the first entry reads as current. */
const currentId = $derived(activeId || (tocItems[0]?.id ?? ''));

/** The share of the viewport, from its top, a heading must pass to become the current one. */
const READING_LINE = 0.3;

function setActive(id: string, items: readonly TocItem[]): void {
  if (id === activeId) return;
  activeId = id;
  onActiveHeadingChange?.(
    id,
    items.find((item) => item.id === id)
  );
}

function textOption(key: string): string | undefined {
  const value = options?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function defaultTitle(layout: Kind): string {
  if (layout === 'blog') return 'Field notes';
  if (layout === 'editorial') return 'The long read';
  return 'Documentation';
}

function headingLevel(heading: HTMLElement): TocLevel {
  const level = Number(heading.tagName.slice(1));
  return level === 3 || level === 4 || level === 5 || level === 6 ? level : 2;
}

function collectHeadings(
  container: HTMLElement,
  selectorLevels: readonly TocLevel[],
  keep: boolean
): TocItem[] {
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(tocSelector(selectorLevels))
  ).filter((heading) => !heading.closest('[data-toc-ignore]'));
  const headings = elements.map((heading) => ({
    ...(heading.id ? { id: heading.id } : {}),
    text: heading.textContent?.trim() ?? '',
    level: headingLevel(heading),
  }));
  const items = buildToc(headings, { preserveIds: keep });
  const listed = new Set<HTMLElement>();
  if (keep) {
    const byId = new Map(items.map((item) => [item.id, item]));
    for (const element of elements) {
      if (byId.has(element.id) && !listed.has(element)) {
        byId.delete(element.id);
        listed.add(element);
      }
    }
  } else {
    let index = 0;
    for (const [elementIndex, heading] of headings.entries()) {
      if (!heading.text.trim()) continue;
      const element = elements[elementIndex];
      const item = items[index];
      index += 1;
      if (!element || !item) continue;
      if (element.id !== item.id) element.id = item.id;
      listed.add(element);
    }
  }
  for (const marked of container.querySelectorAll<HTMLElement>('[data-tx-content-heading]')) {
    if (!listed.has(marked)) marked.removeAttribute('data-tx-content-heading');
  }
  for (const element of listed) {
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    element.setAttribute('data-tx-content-heading', '');
  }
  return items;
}

// Mount imperative content once per content element.
$effect(() => {
  const target = screenTarget;
  if (!target || !mountScreen) return;
  untrack(() => mountScreen(target));
});

$effect(() => {
  const target = screenTarget;
  if (!target) return;
  const selectorLevels = levels;
  const keep = keepIds;
  const entries = providedItems;

  const win = getOwnerWindow(target);
  const observerWindow = win as
    | (Window & {
        MutationObserver?: typeof MutationObserver;
        IntersectionObserver?: typeof IntersectionObserver;
      })
    | undefined;
  const MutationObserverCtor = observerWindow?.MutationObserver ?? globalThis.MutationObserver;
  const IntersectionObserverCtor =
    observerWindow?.IntersectionObserver ?? globalThis.IntersectionObserver;
  let intersection: IntersectionObserver | undefined;
  let current: readonly TocItem[] = [];
  const observed = (): HTMLElement[] => {
    if (!entries) {
      return Array.from(target.querySelectorAll<HTMLElement>('[data-tx-content-heading]'));
    }
    const doc = target.ownerDocument;
    return entries.flatMap((entry) => {
      const element = doc.getElementById(entry.id);
      return element ? [element] : [];
    });
  };
  const refresh = () => {
    let items: readonly TocItem[];
    if (entries) items = entries;
    else {
      items = collectHeadings(target, selectorLevels, keep);
      scannedItems = items as TocItem[];
    }
    current = items;
    if (intersection) {
      intersection.disconnect();
      for (const heading of observed()) intersection.observe(heading);
    }
    const kept = untrack(() => activeId);
    if (!items.some((item) => item.id === kept)) setActive(items[0]?.id ?? '', items);
  };
  /**
   * The heading being read: the last listed one (in document order) whose top
   * passed the reading line, or the first one above them all. The observer
   * only says when a heading crosses the line; positions are read then.
   */
  const track = () => {
    const headings = observed().sort((a, b) =>
      a === b ? 0 : a.compareDocumentPosition(b) & 4 ? -1 : 1
    );
    if (headings.length === 0) return;
    const line = (win?.innerHeight ?? 0) * READING_LINE;
    let reading = headings[0] as HTMLElement;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= line) reading = heading;
      else break;
    }
    setActive(reading.id, current);
  };

  if (typeof IntersectionObserverCtor === 'function') {
    // The band is the top 30% of the viewport: crossing its lower edge moves the reading line.
    intersection = new IntersectionObserverCtor(track, {
      rootMargin: `0px 0px -${100 - READING_LINE * 100}% 0px`,
      threshold: [0, 1],
    });
  }
  untrack(refresh);
  const mutation =
    typeof MutationObserverCtor === 'function' ? new MutationObserverCtor(refresh) : undefined;
  mutation?.observe(target, { childList: true, subtree: true, characterData: true });
  return () => {
    mutation?.disconnect();
    intersection?.disconnect();
  };
});

function fragmentHref(id: string): string | undefined {
  return safeHref(`#${encodeURIComponent(id)}`, 'developer');
}

function safeNavHref(href: string): string | undefined {
  return safeHref(href, 'developer');
}
</script>

<div
  bind:this={root}
  class={cx('tx-content-layout', className)}
  data-tx-content-layout={kind}
>
  <header class="tx-content-layout__header">
    <LayoutChrome part="skip" mainId={mainId} />
    <LayoutChrome part="brand" {nav} />
    {#if nav?.sections.length}
      <nav class="tx-content-layout__top-nav" aria-label="Primary">
        {#each nav.sections as section (section.id)}
          {#each section.items as item (item.id)}
            {@const href = safeNavHref(item.href)}
            {#if href}
              <a href={href} aria-current={isNavPathActive(item.href, path ?? '') ? 'page' : undefined}>
                {item.label}
              </a>
            {/if}
          {/each}
        {/each}
      </nav>
    {/if}
    <LayoutChrome part="actions" {nav} />
  </header>

  <svelte:element this={nested ? 'div' : 'main'} id={mainId} class="tx-content-layout__frame" data-content-kind={kind} tabindex="-1">
    {#if kind === 'docs' && nav?.sections.length}
      <nav class="tx-content-layout__sections" aria-label="Documentation sections">
        {#each nav.sections as section (section.id)}
          {#if section.label}<h2>{section.label}</h2>{/if}
          <ul>
            {#each section.items as item (item.id)}
              {@const href = safeNavHref(item.href)}
              {#if href}
                <li>
                  <a href={href} aria-current={isNavPathActive(item.href, path ?? '') ? 'page' : undefined}>
                    {item.label}
                  </a>
                </li>
              {/if}
            {/each}
          </ul>
        {/each}
      </nav>
    {/if}

    <article class="tx-content-layout__article" data-article-kind={kind}>
      <header class="tx-content-layout__intro">
        {#if eyebrow}<p class="tx-content-layout__eyebrow">{eyebrow}</p>{/if}
        <h1 id={titleId}>{title}</h1>
        {#if summary}<p class="tx-content-layout__summary">{summary}</p>{/if}
        {#if kind !== 'docs' && (author || date || readingTime)}
          <p class="tx-content-layout__byline">
            {#if author}<span>{author}</span>{/if}
            {#if date}<span>{date}</span>{/if}
            {#if readingTime}<span>{readingTime}</span>{/if}
          </p>
        {/if}
      </header>
      <div
        bind:this={screenTarget}
        aria-labelledby={titleId}
        class="tx-content-layout__main"
        role="region"
        tabindex="-1"
      >{@render children?.()}</div>
    </article>

    <aside class="tx-content-layout__toc" aria-label="On this page">
      <details open class="tx-content-layout__toc-details">
        <summary>On this page</summary>
        {#if tocItems.length}
          <ol>
            {#each tocItems as item (item.id)}
              {@const href = fragmentHref(item.id)}
              {#if href}
                <li data-level={item.level}>
                  <a href={href} aria-current={currentId === item.id ? 'location' : undefined}>
                    {item.label}
                  </a>
                </li>
              {/if}
            {/each}
          </ol>
        {:else}
          <p class="tx-content-layout__toc-empty">Sections appear here as the article loads.</p>
        {/if}
      </details>
    </aside>
  </svelte:element>
</div>
