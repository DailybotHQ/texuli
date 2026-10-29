<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { BreadcrumbItem } from './types.ts';
import {
  breadcrumbClass,
  breadcrumbEllipsisClass,
  breadcrumbItemClass,
  breadcrumbLinkClass,
  breadcrumbListClass,
  breadcrumbSeparatorClass,
  type NavSize,
} from './variants.ts';
import './navigation.css';

type OwnProps = {
  items: readonly BreadcrumbItem[];
  /** Landmark name (default "Breadcrumb"). */
  label?: string;
  size?: NavSize;
  /** Accessible name for the separator characters. */
  separatorLabel?: string;
  /** Custom separator content (defaults to "/"). */
  separator?: Snippet;
  /** Collapse middle items past this count into an ellipsis (0 = never). */
  maxItems?: number;
  hrefTrust?: HrefTrust;
  class?: ClassValue;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

/** Extra attributes (`data-*`, `aria-*`, `id`, handlers…) land on the root element. */
type Props = OwnProps & Omit<HTMLAttributes<HTMLElement>, keyof OwnProps | 'children'>;

let {
  items,
  label = 'Breadcrumb',
  size = 'md',
  separatorLabel = 'Separator',
  separator,
  maxItems = 0,
  hrefTrust = 'developer',
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

function bindRef(node: HTMLElement): () => void {
  ref = node;
  return () => {
    if (ref === node) ref = null;
  };
}

type DisplayItem = { kind: 'crumb'; item: BreadcrumbItem; index: number } | { kind: 'ellipsis' };

const display = $derived.by((): DisplayItem[] => {
  const list = [...items];
  if (maxItems <= 0 || list.length <= maxItems) {
    return list.map((item, index) => ({ kind: 'crumb' as const, item, index }));
  }
  const head = list.slice(0, 1);
  const tail = list.slice(-(maxItems - 1));
  return [
    ...head.map((item, index) => ({ kind: 'crumb' as const, item, index })),
    { kind: 'ellipsis' as const },
    ...tail.map((item, offset) => ({
      kind: 'crumb' as const,
      item,
      index: list.length - tail.length + offset,
    })),
  ];
});

function isCurrent(item: BreadcrumbItem, index: number): boolean {
  if (item.current !== undefined) return item.current;
  return index === items.length - 1 && !item.href;
}
</script>

<nav
  {...rest}
  {@attach bindRef}
  class={breadcrumbClass({
    size,
    class: className,
  })}
  data-tx-breadcrumb
  data-size={size}
  aria-label={label}
>
  <ol class={breadcrumbListClass()}>
    {#each display as entry, i (entry.kind === 'ellipsis' ? `e-${i}` : entry.index)}
      {#if entry.kind === 'ellipsis'}
        <li class={breadcrumbItemClass()}>
          <span class={breadcrumbEllipsisClass()}>…</span>
          <span class={breadcrumbSeparatorClass()} aria-hidden="true">
            {#if separator}{@render separator()}{:else}/{/if}
          </span>
        </li>
      {:else}
        {@const current = isCurrent(entry.item, entry.index)}
        {@const href =
          entry.item.href !== undefined ? safeHref(entry.item.href, hrefTrust) : undefined}
        <li class={breadcrumbItemClass()}>
          {#if href && !current}
            <a class={breadcrumbLinkClass()} href={href} data-tx-breadcrumb-link>
              {entry.item.label}
            </a>
          {:else}
            <span
              class={breadcrumbLinkClass({ current: true })}
              aria-current={current ? 'page' : undefined}
              data-tx-breadcrumb-current
            >
              {entry.item.label}
            </span>
          {/if}
          {#if i < display.length - 1}
            <span class={breadcrumbSeparatorClass()} aria-hidden="true">
              {#if separator}{@render separator()}{:else}/{/if}
            </span>
            <span class="sr-only">{separatorLabel}</span>
          {/if}
        </li>
      {/if}
    {/each}
  </ol>
</nav>

<style>
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
