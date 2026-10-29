<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import { composeHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { navigationMenuContext } from './context.ts';

type LinkProps = HTMLAnchorAttributes & {
  /** Marks the current page (`aria-current="page"`). */
  active?: boolean;
  /** URL policy tier for `href` (default `developer`). */
  hrefTrust?: HrefTrust;
  /** Runs when the link is chosen; `event.preventDefault()` keeps the menu open. */
  onSelect?: (event: MouseEvent) => void;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

let {
  href,
  active = false,
  hrefTrust = 'developer',
  onSelect,
  child,
  children,
  ref = $bindable(null),
  ...rest
}: LinkProps & RefProp = $props();
const context = navigationMenuContext.get();
const safe = $derived(typeof href === 'string' ? safeHref(href, hrefTrust) : undefined);

const linkProps = $derived({
  ...rest,
  href: safe,
  'aria-current': active ? ('page' as const) : undefined,
  'data-active': active ? '' : undefined,
  'data-nav-link': '',
  'data-href-blocked': href !== undefined && !safe ? '' : undefined,
  onclick: composeHandlers(rest.onclick, (event: MouseEvent) => {
    onSelect?.(event);
    if (!event.defaultPrevented) context.close();
  }),
});
</script>

{#if child}
  {@render child({ props: composeChildProps(linkProps, {}) })}
{:else}
  <a bind:this={ref} {...linkProps}>{@render children?.()}</a>
{/if}
