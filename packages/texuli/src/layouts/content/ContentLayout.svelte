<script lang="ts">
import { getOwnerWindow } from '@texuli/core/env';
import { safeHref } from '@texuli/core/url-policy';
import { untrack } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import LayoutChrome from '../host/LayoutChrome.svelte';
import { isNavPathActive } from '../host/nav-model.ts';
import { isNestedInMain } from '../host/nested-main.ts';
import { buildToc, type TocItem } from './toc.ts';
import './content.css';

type Kind = 'docs' | 'blog' | 'editorial';
type Props = {
  kind: Kind;
  mountScreen: (target: HTMLElement) => void;
  nav?: import('../host/nav-model.ts').NavModel;
  path?: string;
  options?: import('../host/contract.ts').LayoutOptions;
  storageKey?: string;
  aside?: import('svelte').Snippet;
  class?: ClassValue;
};

let { kind, mountScreen, nav, path, options, class: className }: Props = $props();
let screenTarget = $state<HTMLElement>();
let tocItems = $state<TocItem[]>([]);
let activeId = $state('');
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

function textOption(key: string): string | undefined {
  const value = options?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function defaultTitle(layout: Kind): string {
  if (layout === 'blog') return 'Field notes';
  if (layout === 'editorial') return 'The long read';
  return 'Documentation';
}

function collectHeadings(container: HTMLElement): TocItem[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>('h2, h3')).filter(
    (heading) => !heading.closest('[data-toc-ignore]')
  );
  const headings = elements.map((heading) => ({
    ...(heading.id ? { id: heading.id } : {}),
    text: heading.textContent?.trim() ?? '',
    level: heading.tagName === 'H3' ? (3 as const) : (2 as const),
  }));
  const items = buildToc(headings);
  for (const [index, item] of items.entries()) {
    const element = elements[index];
    if (element && element.id !== item.id) element.id = item.id;
    element?.setAttribute('tabindex', '-1');
    element?.setAttribute('data-tx-content-heading', '');
  }
  return items;
}

$effect(() => {
  const target = screenTarget;
  if (!target) return;
  mountScreen(target);

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
  const refresh = () => {
    tocItems = collectHeadings(target);
    if (intersection) {
      intersection.disconnect();
      for (const heading of target.querySelectorAll<HTMLElement>('[data-tx-content-heading]')) {
        intersection.observe(heading);
      }
    }
    if (!tocItems.some((item) => item.id === activeId)) activeId = tocItems[0]?.id ?? '';
  };

  if (typeof IntersectionObserverCtor === 'function') {
    intersection = new IntersectionObserverCtor((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const id = visible?.target.id;
      if (id) activeId = id;
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
      ></div>
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
                  <a href={href} aria-current={activeId === item.id ? 'location' : undefined}>
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
