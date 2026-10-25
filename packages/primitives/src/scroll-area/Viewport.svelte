<script lang="ts">
import { composeChildProps } from '../internal/child.ts';
import { scrollAreaContext } from './context.ts';
import type { ScrollAreaViewportProps } from './types.ts';

let {
  class: className,
  children,
  child,
  id,
  tabindex = 0,
  ...rest
}: ScrollAreaViewportProps & Record<string, unknown> = $props();

const context = scrollAreaContext.get();

function attach(node: HTMLElement): () => void {
  context.setViewport(node);
  const onScroll = () => context.notifyScroll();
  node.addEventListener('scroll', onScroll, { passive: true });

  const ResizeObserverCtor = node.ownerDocument.defaultView?.ResizeObserver;
  const ro =
    ResizeObserverCtor === undefined
      ? undefined
      : new ResizeObserverCtor(() => context.notifyScroll());
  ro?.observe(node);
  if (node.firstElementChild) ro?.observe(node.firstElementChild);

  // Initial measure after layout.
  queueMicrotask(() => context.notifyScroll());

  return () => {
    node.removeEventListener('scroll', onScroll);
    ro?.disconnect();
    context.setViewport(undefined);
  };
}

const baseStyle =
  'overflow: auto; overscroll-behavior: contain; scrollbar-width: none; -ms-overflow-style: none;';
const viewportProps = $derived({
  ...rest,
  id,
  class: typeof className === 'string' ? className : undefined,
  tabindex,
  'data-tx-scroll-area-viewport': '',
  // Native scrolling remains the source of truth for keyboard and AT.
  style: [baseStyle, typeof rest.style === 'string' ? rest.style : ''].filter(Boolean).join(' '),
});
</script>

{#if child}
  {@render child({ props: composeChildProps({ ...viewportProps, attach }, {}) })}
{:else}
  <div {...viewportProps} {@attach attach}>
    {@render children?.()}
  </div>
{/if}
