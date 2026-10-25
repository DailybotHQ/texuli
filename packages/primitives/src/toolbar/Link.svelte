<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes } from 'svelte/elements';
import { TOOLBAR_ITEM } from './context.ts';

type Props = Omit<HTMLAnchorAttributes, 'children'> & {
  /** `developer` (default) for app links, `untrusted` for agent or user content. */
  hrefTrust?: HrefTrust;
  ref?: HTMLElement | null;
  children?: Snippet;
};

let { href, hrefTrust = 'developer', ref = $bindable(null), children, ...rest }: Props = $props();

// A rejected href renders no href at all: the item stays in the toolbar, inert.
const safe = $derived(href ? safeHref(href, hrefTrust) : undefined);
</script>

<a
  bind:this={ref}
  {...rest}
  href={safe}
  aria-disabled={safe ? undefined : 'true'}
  tabindex={-1}
  {...{ [TOOLBAR_ITEM]: '' }}>{@render children?.()}</a
>
