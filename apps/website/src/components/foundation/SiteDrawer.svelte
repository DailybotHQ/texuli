<script lang="ts">
/**
 * The phone navigation drawer: Texuli's `Sheet` (focus trapped, Escape and
 * the close button close it, focus returns to the menu button) around the
 * page's own sidebar navigation, moved in while the drawer is open and back
 * out when it closes, so the page ships the navigation only once.
 */
import { Sheet } from 'texuli/sheet';

type Props = {
  opener: HTMLButtonElement;
};

let { opener }: Props = $props();
let open = $state(false);

// The menu button reports the drawer's state, however it opened or closed.
$effect(() => {
  opener.setAttribute('aria-expanded', String(open));
});

/** Opens the drawer (called by the menu button). */
export function show(): void {
  open = true;
}

/** Moves the page's sidebar navigation into the drawer, and back on close. */
function adopt(host: HTMLElement): () => void {
  const nav = document.querySelector<HTMLElement>('[data-site-nav]');
  const home = nav?.parentElement;
  if (!nav || !home) return () => {};
  const marker = document.createComment('site-nav');
  home.insertBefore(marker, nav);
  host.append(nav);
  nav.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'center' });
  return () => {
    marker.replaceWith(nav);
  };
}
</script>

<Sheet.Root
  bind:open
  onCloseAutoFocus={(event) => {
    event.preventDefault();
    opener.focus({ preventScroll: true });
  }}
>
  <Sheet.Portal>
    <Sheet.Overlay />
    <Sheet.Content side="start" size="sm" class="site-drawer" data-tx-site-drawer="">
      <div class="site-drawer__top">
        <Sheet.Title class="site-drawer__title">Navigation</Sheet.Title>
        <Sheet.Close class="site-drawer__close" aria-label="Close navigation">×</Sheet.Close>
      </div>
      <div class="site-drawer__body" {@attach adopt}></div>
    </Sheet.Content>
  </Sheet.Portal>
</Sheet.Root>

<style>
  :global(.site-drawer) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .site-drawer__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  :global(.site-drawer__title) {
    margin: 0;
    font-size: 1rem;
  }
  :global(.site-drawer__close) {
    display: inline-grid;
    place-items: center;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.375rem);
    background: transparent;
    color: var(--tx-foreground);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
  }
  :global(.site-drawer__close:focus-visible) {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .site-drawer__body {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-y: auto;
  }
</style>
