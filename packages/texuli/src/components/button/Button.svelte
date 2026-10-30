<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type ButtonSize, type ButtonVariant, buttonVariants } from './button-variants.ts';
import './button.css';
import { designDefaults } from '../../internal/design-defaults.ts';

type ButtonProps = HTMLButtonAttributes &
  HTMLAnchorAttributes & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Destination when rendering as a link. Filtered by the URL policy. */
    href?: string | null;
    /** Trust tier for `href` (default `developer` for app-authored props). */
    hrefTrust?: HrefTrust;
    loading?: boolean;
    /** Accessible name announced while loading (defaults to visible label text). */
    loadingLabel?: string;
    /**
     * When `onclick` returns a promise, show pending until it settles.
     * Default `true`.
     */
    autoLoading?: boolean;
    /**
     * Plain-text label, rendered as escaped text. A non-empty `label`
     * replaces `children` when both are given.
     */
    label?: string;
    class?: ClassValue;
    children?: import('svelte').Snippet;
    /** The rendered root element (`<button>` or `<a>`, bindable). */
    ref?: HTMLElement | null;
  };

const txDefaults = designDefaults('button');
let {
  class: className,
  variant = txDefaults().variant ?? 'default',
  size = txDefaults().size ?? 'md',
  href = undefined,
  hrefTrust = 'developer',
  type = 'button',
  disabled = false,
  loading = false,
  loadingLabel,
  autoLoading = true,
  label,
  onclick,
  children,
  ref = $bindable(null),
  ...rest
}: ButtonProps = $props();

let pending = $state(false);
const busy = $derived(Boolean(loading) || pending);
const inactive = $derived(Boolean(disabled) || busy);
const classes = $derived(cx(buttonVariants({ variant, size }), className));
const hasLabel = $derived(typeof label === 'string' && label.length > 0);
const resolvedHref = $derived(
  typeof href === 'string' && href.length > 0 ? safeHref(href, hrefTrust) : undefined
);

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

// biome-ignore lint/suspicious/noExplicitAny: shared by <a> and <button>
function handleClick(event: any): void {
  if (inactive) {
    event.preventDefault();
    return;
  }
  // biome-ignore lint/suspicious/noExplicitAny: dual element handler
  const result: unknown = (onclick as any)?.(event);
  if (!autoLoading || !isThenable(result)) return;
  pending = true;
  Promise.resolve(result).finally(() => {
    pending = false;
  });
}
</script>

{#snippet text()}
  {#if hasLabel}{label}{:else}{@render children?.()}{/if}
{/snippet}

{#snippet content()}
  {#if busy}
    <span class="tx-button__spinner" data-tx-button-spinner aria-hidden="true">
      <span class="tx-button__spinner-icon"></span>
    </span>
    <!-- With `loadingLabel`, that text IS the name; the visible label must not join it. -->
    <span class="tx-button__label--hidden" aria-hidden={loadingLabel ? 'true' : undefined}
      >{@render text()}</span
    >
    {#if loadingLabel}
      <span class="tx-button__sr-only">{loadingLabel}</span>
    {/if}
  {:else}
    {@render text()}
  {/if}
{/snippet}

{#if resolvedHref !== undefined}
  <a
    bind:this={ref}
    class={classes}
    href={inactive ? undefined : resolvedHref}
    role={inactive ? 'link' : undefined}
    aria-disabled={inactive || undefined}
    aria-busy={busy || undefined}
    tabindex={inactive ? -1 : undefined}
    data-tx-button
    data-variant={variant}
    data-size={size}
    {...rest}
    onclick={handleClick}
  >
    {@render content()}
  </a>
{:else if href}
  <!-- Unsafe or empty href: render a disabled button so authors see no dead link. -->
  <button
    bind:this={ref}
    class={classes}
    type="button"
    disabled
    aria-disabled="true"
    data-tx-button
    data-variant={variant}
    data-size={size}
    data-href-blocked="true"
    {...rest}
  >
    {@render content()}
  </button>
{:else}
  <!--
    Busy (loading or a pending onclick promise) is aria-disabled with the
    click suppressed in handleClick, never native `disabled`: a focused
    button keeps focus instead of dropping it to <body> (G94).
  -->
  <button
    bind:this={ref}
    class={classes}
    {type}
    disabled={Boolean(disabled)}
    aria-disabled={busy && !disabled ? 'true' : undefined}
    aria-busy={busy || undefined}
    data-tx-button
    data-variant={variant}
    data-size={size}
    {...rest}
    onclick={handleClick}
  >
    {@render content()}
  </button>
{/if}
