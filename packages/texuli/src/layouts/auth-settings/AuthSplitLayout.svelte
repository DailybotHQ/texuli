<script lang="ts">
import type { Snippet } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { isNestedInMain } from '../host/nested-main.ts';
import './auth-settings.css';

/**
 * Split authentication frame: form column + brand panel (desktop).
 * On narrow viewports only the form column shows. Brand copy is author-provided
 * (no product default strings).
 */
type Props = {
  /** Sign-in / sign-up form body. */
  form?: Snippet;
  /**
   * LayoutHost integration: mounts the stable routed screen in the form column
   * when `form` is not provided.
   */
  mountScreen?: (target: HTMLElement) => void;
  /** Small mark above the form (logo wordmark). */
  brand?: Snippet;
  /** Large brand panel content; when absent, title/description render if set. */
  panel?: Snippet;
  /** Brand panel heading (author-localized; no default). */
  brandTitle?: string;
  /** Brand panel supporting copy (author-localized; no default). */
  brandDescription?: string;
  /** Optional eyebrow above the brand title. */
  brandEyebrow?: string;
  /** Accessible name of the form column. */
  formLabel?: string;
  /** Accessible name of the brand panel. */
  panelLabel?: string;
  class?: ClassValue;
};

let {
  form,
  mountScreen,
  brand,
  panel,
  brandTitle,
  brandDescription,
  brandEyebrow,
  formLabel = 'Sign in',
  panelLabel = 'About this workspace',
  class: className,
}: Props = $props();

let screenTarget = $state<HTMLDivElement | undefined>();
let root = $state<HTMLElement | undefined>();
/** Inside another page <main> (docs live demos), render a region instead of a second main. */
let nested = $state(false);

$effect(() => {
  nested = isNestedInMain(root);
});
$effect(() => {
  if (mountScreen && screenTarget) mountScreen(screenTarget);
});
</script>

<svelte:element
  this={nested ? 'div' : 'main'}
  bind:this={root}
  class={cx('tx-auth-split', className)}
  data-tx-layout="auth-split"
  data-tx-auth-split
  role={nested ? 'region' : undefined}
  aria-label={nested ? 'Authentication layout' : undefined}
  tabindex={nested ? 0 : undefined}
>
  <section class="tx-auth-split__form" aria-label={formLabel}>
    <div class="tx-auth-split__form-inner">
      {#if brand}
        <div class="tx-auth-split__brand-mark">{@render brand()}</div>
      {/if}
      {#if form}
        {@render form()}
      {:else if mountScreen}
        <div bind:this={screenTarget} data-tx-layout-screen-target></div>
      {/if}
    </div>
  </section>

  <aside class="tx-auth-split__panel" aria-label={panelLabel}>
    <svg
      class="tx-auth-split__pattern"
      viewBox="0 0 480 640"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0 48h480M0 128h480M0 208h480M0 288h480M0 368h480M0 448h480M0 528h480M0 608h480M40 0v640M120 0v640M200 0v640M280 0v640M360 0v640M440 0v640"
        stroke="currentColor"
        stroke-width="1"
        fill="none"
      />
      <path
        d="M40 48l40 40 40-40 40 40 40-40 40 40 40-40 40 40 40-40 40 40 40-40M40 208l40 40 40-40 40 40 40-40 40 40 40-40 40 40 40-40 40 40 40-40M40 368l40 40 40-40 40 40 40-40 40 40 40-40 40 40 40-40 40 40 40-40M40 528l40 40 40-40 40 40 40-40 40 40 40-40 40 40 40-40 40 40 40-40"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      />
    </svg>
    <div class="tx-auth-split__panel-card">
      {#if panel}
        {@render panel()}
      {:else}
        {#if brandEyebrow}
          <p class="tx-auth-split__eyebrow">{brandEyebrow}</p>
        {/if}
        {#if brandTitle}
          <h1 class="tx-auth-split__title">{brandTitle}</h1>
        {/if}
        {#if brandDescription}
          <p class="tx-auth-split__description">{brandDescription}</p>
        {/if}
      {/if}
    </div>
  </aside>
</svelte:element>
