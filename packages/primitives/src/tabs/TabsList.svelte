<script lang="ts">
import { createRovingFocus, indexOfSelected } from '@texuli/core/roving';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';
import { chainHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { tabsContext } from './context.ts';

type Props = HTMLAttributes<HTMLDivElement> & {
  class?: string;
  children?: import('svelte').Snippet;
} & RefProp;

let { class: className, children, onfocusin, ref = $bindable(null), ...rest }: Props = $props();

const tabs = tabsContext.get();

function attachTabRoving(): Attachment<HTMLElement> {
  return (root) => {
    const getItems = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          '[data-tx-tabs-trigger]:not([disabled]):not([data-disabled])'
        )
      );
    const roving = createRovingFocus({
      items: getItems,
      orientation: tabs.orientation(),
      wrap: tabs.loop(),
      homeEnd: true,
      // The selected tab is the tab stop (APG), not the first tab.
      selected: () => indexOfSelected(getItems()),
    });
    roving.sync();
    const onKeydown = (event: KeyboardEvent) => roving.handleKeydown(event);
    const onFocus = (event: FocusEvent) => roving.handleFocusIn(event);
    root.addEventListener('keydown', onKeydown);
    root.addEventListener('focusin', onFocus);
    const MutationObserverCtor = root.ownerDocument.defaultView?.MutationObserver;
    const observer = MutationObserverCtor
      ? new MutationObserverCtor(() => roving.sync())
      : undefined;
    observer?.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['disabled', 'data-disabled', 'data-state', 'aria-selected'],
    });
    return () => {
      observer?.disconnect();
      root.removeEventListener('keydown', onKeydown);
      root.removeEventListener('focusin', onFocus);
    };
  };
}

const roving = $derived(attachTabRoving());

/** Automatic mode: focusing a tab selects it. */
function onFocusIn(event: FocusEvent): void {
  if (tabs.disabled()) return;
  if (tabs.activationMode() !== 'automatic') return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.hasAttribute('data-tx-tabs-trigger')) return;
  if (target.hasAttribute('disabled') || target.hasAttribute('data-disabled')) return;
  const next = target.getAttribute('data-value');
  if (next) tabs.select(next);
}
</script>

<div bind:this={ref}
  role="tablist"
  class={className}
  data-orientation={tabs.orientation()}
  aria-orientation={tabs.orientation()}
  {@attach roving}
  {...rest}
  onfocusin={chainHandlers(onfocusin, onFocusIn)}
>
  {@render children?.()}
</div>
