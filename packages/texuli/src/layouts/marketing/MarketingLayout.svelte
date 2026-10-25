<script lang="ts">
import type { Snippet } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { isNestedInMain } from '../host/nested-main.ts';
import type { LayoutProps } from '../host/registry.ts';
import './marketing.css';

/**
 * Marketing page frame: sticky-feel header, hero or LayoutHost screen outlet,
 * optional sections and footer. Logical CSS; RTL via inherited `dir`.
 */
type Props = {
  /** LayoutHost integration; the stable routed screen mounts in the main column. */
  mountScreen?: LayoutProps['mountScreen'];
  /** Accepted for LayoutHost compatibility; marketing pages usually use slots. */
  nav?: LayoutProps['nav'];
  path?: LayoutProps['path'];
  options?: LayoutProps['options'];
  storageKey?: LayoutProps['storageKey'];
  aside?: LayoutProps['aside'];
  brand?: Snippet;
  navigation?: Snippet;
  actions?: Snippet;
  hero?: Snippet;
  sections?: Snippet;
  footer?: Snippet;
  navigationLabel?: string;
  heroLabel?: string;
  contentLabel?: string;
  class?: ClassValue;
};

let {
  mountScreen,
  nav: _nav,
  path: _path,
  options: _options,
  storageKey: _storageKey,
  aside: _aside,
  brand,
  navigation,
  actions,
  hero,
  sections,
  footer,
  navigationLabel = 'Main navigation',
  heroLabel = 'Introduction',
  contentLabel = 'Page content',
  class: className,
}: Props = $props();

let screenTarget = $state<HTMLDivElement | undefined>();
let root = $state<HTMLElement | undefined>();
let nested = $state(false);

$effect(() => {
  nested = isNestedInMain(root);
});
$effect(() => {
  if (mountScreen && screenTarget) mountScreen(screenTarget);
});
</script>

<div
  bind:this={root}
  class={cx('tx-marketing-layout', className)}
  data-tx-marketing-layout=""
>
  <header class="tx-marketing-layout__header">
    <div class="tx-marketing-layout__header-inner">
      <div class="tx-marketing-layout__brand">{@render brand?.()}</div>
      <nav class="tx-marketing-layout__nav" aria-label={navigationLabel}>
        {@render navigation?.()}
      </nav>
      <div class="tx-marketing-layout__actions">{@render actions?.()}</div>
    </div>
  </header>

  <svelte:element this={nested ? 'div' : 'main'} class="tx-marketing-layout__main">
    {#if hero}
      <section class="tx-marketing-layout__hero" aria-label={heroLabel}>{@render hero()}</section>
    {:else if mountScreen}
      <section class="tx-marketing-layout__screen" aria-label={contentLabel}>
        <div bind:this={screenTarget} data-tx-layout-screen-target=""></div>
      </section>
    {/if}
    {@render sections?.()}
  </svelte:element>

  {#if footer}
    <footer class="tx-marketing-layout__footer">
      <div class="tx-marketing-layout__footer-inner">{@render footer()}</div>
    </footer>
  {/if}
</div>
