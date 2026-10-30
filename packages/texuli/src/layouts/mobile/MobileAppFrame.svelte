<script lang="ts">
import type { Snippet } from 'svelte';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './mobile.css';

/**
 * A standalone mobile app frame: a skip link, a header that stays put, the
 * scrolling screen, an optional sticky footer (screen actions) and the bottom
 * navigation. It fills `--tx-app-height` (default `100dvh`); set that variable
 * on an ancestor to fit a contained frame such as a device preview.
 */
type Props = {
  /** Usually a `MobileHeader`; outside the scroll region. */
  header?: Snippet;
  /** Usually a `BottomNav`; outside the scroll region. */
  bottomNav?: Snippet;
  /**
   * Screen-level actions between the scroll region and the bottom navigation.
   * While it renders nothing (an `{#if}` that is false), its padded, bordered
   * strip is hidden (`hidden`, `data-empty`).
   */
  stickyFooter?: Snippet;
  children: Snippet;
  /** The skip link's text. Default "Skip to content". */
  skipLabel?: string;
  /** `id` of the screen region. Default: a generated id. */
  mainId?: string;
  /** `div` inside another page's `<main>` (previews): no nested main landmark. Auto-detected too. */
  mainElement?: 'main' | 'div';
  /** Scroll the screen back to the top on hash or history navigation. Default `true`. */
  resetScrollOnNavigate?: boolean;
  class?: ClassValue;
  mainClass?: ClassValue;
};

let {
  header,
  bottomNav,
  stickyFooter,
  children,
  skipLabel: skipLabelProp,
  mainId,
  mainElement = 'main',
  resetScrollOnNavigate = true,
  class: className,
  mainClass,
}: Props = $props();
const msg = useMessages();
const skipLabel = $derived(
  skipLabelProp ?? msg('texuli.mobile-app-frame.skip-label', 'Skip to content')
);

const uid = $props.id();
const screenId = $derived(mainId ?? `${uid}-main`);
let frame = $state<HTMLElement>();
let screen = $state<HTMLElement>();
let nested = $state(false);

$effect(() => {
  nested = Boolean(frame?.parentElement?.closest('main'));
});

$effect(() => {
  const view = frame?.ownerDocument.defaultView;
  if (!resetScrollOnNavigate || !view) return;
  const reset = () => {
    if (screen) screen.scrollTop = 0;
  };
  view.addEventListener('hashchange', reset);
  view.addEventListener('popstate', reset);
  return () => {
    view.removeEventListener('hashchange', reset);
    view.removeEventListener('popstate', reset);
  };
});

let footer = $state<HTMLElement>();
let footerEmpty = $state(false);

/** No element and no visible text: comments and whitespace count as empty. */
function isEmpty(node: HTMLElement): boolean {
  return node.childElementCount === 0 && (node.textContent ?? '').trim() === '';
}

$effect(() => {
  const node = footer;
  if (!node) return;
  footerEmpty = isEmpty(node);
  if (typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(() => {
    footerEmpty = isEmpty(node);
  });
  observer.observe(node, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
});

function focusScreen(event: MouseEvent): void {
  // A hash router would read the fragment as a route, so focus the screen instead.
  event.preventDefault();
  screen?.focus();
}
</script>

<div bind:this={frame} class={cx('tx-mobile-frame', className)} data-tx-mobile-frame="">
  <a class="tx-mobile-frame__skip" href={`#${screenId}`} onclick={focusScreen}>{skipLabel}</a>
  {@render header?.()}
  <svelte:element
    this={mainElement === 'div' || nested ? 'div' : 'main'}
    bind:this={screen}
    id={screenId}
    tabindex="-1"
    class={cx('tx-mobile-frame__main', mainClass)}
    data-tx-mobile-frame-main=""
  >
    {@render children()}
  </svelte:element>
  {#if stickyFooter}
    <div
      bind:this={footer}
      class="tx-mobile-frame__footer"
      data-tx-mobile-frame-footer=""
      data-empty={footerEmpty ? '' : undefined}
      hidden={footerEmpty}
    >{@render stickyFooter()}</div>
  {/if}
  {@render bottomNav?.()}
</div>
