<script lang="ts">
/**
 * Link (ADR-032): an inline sentence link. Color and underline come from link
 * tokens; `href` is filtered by `safeHref` (developer tier for app-authored
 * props). An http(s) URL, `external`, or `target="_blank"` adds
 * `noopener noreferrer`. A refused href renders as text, never a dead link.
 */
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { HTMLAnchorAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import './typography.css';

type Props = Omit<HTMLAnchorAttributes, 'href'> & {
  /** Destination. Filtered by the URL policy. */
  href: string;
  /** Trust tier for `href` (default `developer` for app-authored props). */
  hrefTrust?: HrefTrust;
  /**
   * Adds `rel="noopener noreferrer"`. Also added for http(s) hrefs and
   * `target="_blank"`.
   */
  external?: boolean;
  /** Plain-text label, rendered as escaped text; replaces `children` when non-empty. */
  label?: string;
  /** The rendered element (bindable). */
  ref?: HTMLElement | null;
};

let {
  href,
  hrefTrust = 'developer',
  external = false,
  target,
  rel,
  label,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const safe = $derived(
  typeof href === 'string' && href.length > 0 ? safeHref(href, hrefTrust) : undefined
);
const hasLabel = $derived(typeof label === 'string' && label.length > 0);
const linkRel = $derived(linkRelationship(rel ?? undefined, target ?? undefined, external, safe));

function isHttpUrl(value: string): boolean {
  return value.startsWith('https:') || value.startsWith('http:');
}

function linkRelationship(
  value: string | undefined,
  linkTarget: string | null | undefined,
  markedExternal: boolean,
  hrefValue: string | undefined
): string | undefined {
  const tokens = (value ?? '').split(/\s+/).filter(Boolean);
  const needs =
    markedExternal ||
    linkTarget?.toLowerCase() === '_blank' ||
    (hrefValue !== undefined && isHttpUrl(hrefValue));
  if (needs) {
    if (!tokens.some((token) => token.toLowerCase() === 'noopener')) tokens.push('noopener');
    if (!tokens.some((token) => token.toLowerCase() === 'noreferrer')) tokens.push('noreferrer');
  }
  return tokens.length > 0 ? tokens.join(' ') : undefined;
}
</script>

{#snippet text()}
  {#if hasLabel}{label}{:else}{@render children?.()}{/if}
{/snippet}

{#if safe}
  <a
    bind:this={ref}
    {...rest}
    class={cx('tx-link', className)}
    href={safe}
    {target}
    rel={linkRel}
    data-tx-component="link"
  >{@render text()}</a>
{:else}
  <span bind:this={ref} class={cx('tx-link', className)} data-tx-component="link" data-href-blocked="true"
    >{@render text()}</span
  >
{/if}
