<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { VisuallyHidden } from '../separator-aspect/index.ts';
import { Tooltip } from '../tooltip/index.ts';
import type { SidebarChildItem, SidebarItem, SidebarSection } from './types.ts';
import {
  type SidebarVariant,
  sidebarClass,
  sidebarItemClass,
  sidebarSectionClass,
  sidebarToggleClass,
} from './variants.ts';
import './sidebar.css';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  /** Flat list; use `sections` for grouped navigation. */
  items?: readonly SidebarItem[];
  sections?: readonly SidebarSection[];
  /** Icons-only rail. Ignored when `drawer` is true. */
  collapsed?: boolean;
  collapsible?: boolean;
  /** Mobile drawer host: full width, no collapse control. */
  drawer?: boolean;
  variant?: SidebarVariant;
  /** Brand / workspace slot. */
  header?: Snippet<[{ collapsed: boolean }]>;
  footer?: Snippet<[{ collapsed: boolean }]>;
  /** Optional leading icon per item. */
  itemIcon?: Snippet<[item: SidebarItem, collapsed: boolean]>;
  /**
   * Show the leading icon box when expanded (default `true`). Docs-style text
   * navigation sets `false`; the collapsed rail always shows icons.
   */
  showIcons?: boolean;
  label?: string;
  collapseLabel?: string;
  expandLabel?: string;
  hrefTrust?: HrefTrust;
  class?: ClassValue;
};

let {
  items,
  sections,
  collapsed = $bindable(false),
  collapsible = true,
  drawer = false,
  variant = 'default',
  header,
  footer,
  itemIcon,
  showIcons = true,
  label = 'Main',
  collapseLabel = 'Collapse sidebar',
  expandLabel = 'Expand sidebar',
  hrefTrust = 'developer',
  class: className,
  ...rest
}: Props = $props();

const isCollapsed = $derived(Boolean(collapsed) && !drawer);
const uid = $props.id();

/** `aria-current` for an item: the page itself, or a section the page is in. */
function currentOf(item: SidebarItem): 'page' | 'true' | undefined {
  if (item.current === 'section') return 'true';
  if (item.current === 'page' || item.active) return 'page';
  return undefined;
}
const isActive = (item: SidebarItem) => Boolean(item.active || item.current);
const groups = $derived<readonly SidebarSection[]>(sections ?? (items ? [{ items }] : []));

const rootClass = $derived(
  sidebarClass({
    variant,
    class: className,
  })
);

function itemKey(item: SidebarItem, index: number): string {
  return item.id ?? `${item.href ?? ''}:${item.label}:${index}`;
}

function shortOf(item: SidebarItem): string {
  if (item.shortLabel?.trim()) return item.shortLabel.trim().slice(0, 2);
  const letters = item.label.replace(/[^\p{L}\p{N}]/gu, '');
  return (letters.slice(0, 2) || item.label.slice(0, 2) || '?').toUpperCase();
}

function hrefOf(item: Pick<SidebarItem, 'href'>): string | undefined {
  if (!item.href) return undefined;
  return safeHref(item.href, hrefTrust);
}
</script>

{#snippet node(item: SidebarItem | SidebarChildItem)}
  {@const href = hrefOf(item)}
  {@const itemClass = sidebarItemClass({
    active: isActive(item),
    collapsed: isCollapsed,
    disabled: Boolean(item.disabled),
  })}
  {#if isCollapsed}
    <Tooltip content={item.label} side="right" disabled={item.disabled}>
      {#snippet children({ props })}
        {#if href && !item.disabled}
          <a
            {...props}
            {href}
            class={itemClass}
            aria-current={currentOf(item)}
            data-tx-sidebar-item
            data-active={isActive(item) ? '' : undefined}
          >
            <span class="tx-sidebar__icon" aria-hidden="true">
              {#if itemIcon}
                {@render itemIcon(item, true)}
              {:else}
                {shortOf(item)}
              {/if}
            </span>
            <VisuallyHidden>{item.label}</VisuallyHidden>
            {#if item.badge !== undefined}
              <span class="tx-sidebar__badge-dot" aria-hidden="true"></span>
              <VisuallyHidden>({item.badge})</VisuallyHidden>
            {/if}
          </a>
        {:else}
          <span
            {...props}
            class={itemClass}
            role="link"
            aria-disabled="true"
            data-tx-sidebar-item
          >
            <span class="tx-sidebar__icon" aria-hidden="true">
              {#if itemIcon}
                {@render itemIcon(item, true)}
              {:else}
                {shortOf(item)}
              {/if}
            </span>
            <VisuallyHidden>{item.label}</VisuallyHidden>
          </span>
        {/if}
      {/snippet}
    </Tooltip>
  {:else if href && !item.disabled}
    <a
      {href}
      class={itemClass}
      aria-current={currentOf(item)}
      data-tx-sidebar-item
      data-active={isActive(item) ? '' : undefined}
    >
      {#if showIcons}
        <span class="tx-sidebar__icon" aria-hidden="true">
          {#if itemIcon}
            {@render itemIcon(item, false)}
          {:else}
            {shortOf(item)}
          {/if}
        </span>
      {/if}
      <span class="tx-sidebar__label">{item.label}</span>
      {#if item.badge !== undefined}
        <span class="tx-sidebar__badge">{item.badge}</span>
      {/if}
    </a>
  {:else if item.children?.length}
    <span class="tx-sidebar__item tx-sidebar__item--parent">
      <span class="tx-sidebar__label">{item.label}</span>
    </span>
  {:else}
    <span
      class={itemClass}
      role="link"
      aria-disabled="true"
      data-tx-sidebar-item
    >
      {#if showIcons}
        <span class="tx-sidebar__icon" aria-hidden="true">
          {#if itemIcon}
            {@render itemIcon(item, false)}
          {:else}
            {shortOf(item)}
          {/if}
        </span>
      {/if}
      <span class="tx-sidebar__label">{item.label}</span>
      {#if item.badge !== undefined}
        <span class="tx-sidebar__badge">{item.badge}</span>
      {/if}
    </span>
  {/if}
{/snippet}

<nav
  class={rootClass}
  aria-label={label}
  data-tx-sidebar
  data-variant={variant}
  data-collapsed={isCollapsed ? '' : undefined}
  data-drawer={drawer ? '' : undefined}
  {...rest}
>
  {#if header}
    <div class="tx-sidebar__header" data-tx-sidebar-header>
      {@render header({ collapsed: isCollapsed })}
    </div>
  {/if}

  <div class="tx-sidebar__body" data-tx-sidebar-body>
    {#each groups as group, groupIndex (group.label ?? groupIndex)}
      <div class={sidebarSectionClass()} data-tx-sidebar-section>
        {#if group.label}
          {#if isCollapsed}
            {#if groupIndex > 0}
              <hr class="tx-sidebar__section-rule" aria-hidden="true" />
            {/if}
          {:else}
            <p class="tx-sidebar__section-label" id={`${uid}-group-${groupIndex}`}>{group.label}</p>
          {/if}
        {/if}
        <ul
          class="tx-sidebar__list"
          aria-labelledby={group.label && !isCollapsed ? `${uid}-group-${groupIndex}` : undefined}
        >
          {#each group.items as item, itemIndex (itemKey(item, itemIndex))}
            <li>
              {@render node(item)}
              {#if item.children?.length && !isCollapsed}
                <ul class="tx-sidebar__list tx-sidebar__list--nested">
                  {#each item.children as child, childIndex (itemKey(child, childIndex))}
                    <li>{@render node(child)}</li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>

  {#if footer || (collapsible && !drawer)}
    <div class="tx-sidebar__footer" data-tx-sidebar-footer>
      {@render footer?.({ collapsed: isCollapsed })}
      {#if collapsible && !drawer}
        <button
          type="button"
          class={sidebarToggleClass({ collapsed: isCollapsed })}
          aria-expanded={!isCollapsed}
          aria-controls={undefined}
          data-tx-sidebar-toggle
          onclick={() => (collapsed = !collapsed)}
        >
          <span class="tx-sidebar__toggle-icon" aria-hidden="true">
            {#if isCollapsed}
              »
            {:else}
              «
            {/if}
          </span>
          {#if isCollapsed}
            <VisuallyHidden>{expandLabel}</VisuallyHidden>
          {:else}
            <span class="tx-sidebar__label">{collapseLabel}</span>
          {/if}
        </button>
      {/if}
    </div>
  {/if}
</nav>
