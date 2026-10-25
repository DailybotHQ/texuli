<script lang="ts">
import { safeHref } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import LayoutChrome from '../host/LayoutChrome.svelte';
import type { StackHeader } from './model.ts';
import './mobile.css';

/**
 * The frame both mobile layouts share: a skip link, a sticky header (Back to
 * the parent screen when the stack is deeper than a tab's root, the screen's
 * title, then actions), the screen region, and an optional bottom bar.
 */
type Props = {
  kind: 'tabs' | 'drawer';
  header: StackHeader;
  /** Receives the element the routed screen mounts into. */
  onscreen: (node: HTMLElement) => void;
  backLabel: string;
  skipLabel?: string;
  actions?: Snippet;
  bottom?: Snippet;
};

let { kind, header, onscreen, backLabel, skipLabel, actions, bottom }: Props = $props();

const uid = $props.id();
const mainId = `${uid}-main`;
let screen = $state<HTMLElement>();
let frame = $state<HTMLElement>();
/** Inside another `<main>` (an embedded preview), the screen region is a plain `div`. */
let nested = $state(false);

$effect(() => {
  nested = Boolean(frame?.parentElement?.closest('main'));
});
const backHref = $derived(header.back ? safeHref(header.back.href, 'developer') : undefined);

$effect(() => {
  if (screen) onscreen(screen);
});
</script>

<div bind:this={frame} class="tx-mobile-layout" data-tx-mobile-layout={kind} data-depth={header.depth}>
  <LayoutChrome part="skip" {mainId} {...skipLabel ? { skipLabel } : {}} />
  <header class="tx-mobile-layout__header">
    {#if header.back && backHref}
      <!-- The name keeps the visible word first (WCAG 2.5.3) and adds where Back goes. -->
      <a
        class="tx-mobile-layout__back"
        href={backHref}
        aria-label={`${backLabel}: ${header.back.label}`}
        data-tx-mobile-back=""
      >
        <svg class="tx-mobile-layout__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        <span class="tx-mobile-layout__back-label">{backLabel}</span>
      </a>
    {/if}
    <p class="tx-mobile-layout__title" data-tx-mobile-title="">{header.title}</p>
    {#if actions}<div class="tx-mobile-layout__actions">{@render actions()}</div>{/if}
  </header>
  <!-- The screen region is the page's <main>, unless the layout already sits
       inside one (an embedded preview): one main landmark per page. -->
  <svelte:element this={nested ? 'div' : 'main'} id={mainId} class="tx-mobile-layout__main" tabindex="-1">
    <div bind:this={screen} class="tx-mobile-layout__screen" data-tx-mobile-screen=""></div>
  </svelte:element>
  {#if bottom}{@render bottom()}{/if}
</div>
