<script lang="ts">
import { rootContext } from './context.ts';
import type { AccordionRootProps } from './types.ts';

/**
 * Accordion root (APG Accordion). Every trigger stays in the Tab order; arrow
 * keys, Home and End also move between triggers, skipping disabled ones.
 */
let {
  type,
  value = $bindable(),
  onValueChange,
  collapsible = true,
  disabled = false,
  orientation = 'vertical',
  loop = true,
  dir,
  child,
  children,
  ref = $bindable(null),
  onkeydown,
  ...rest
}: AccordionRootProps = $props();

const open = $derived(
  type === 'multiple'
    ? Array.isArray(value)
      ? value
      : []
    : typeof value === 'string' && value !== ''
      ? [value]
      : []
);

function commit(next: string[]) {
  if (type === 'multiple') {
    value = next;
    (onValueChange as ((v: string[]) => void) | undefined)?.(next);
  } else {
    const single = next[0] ?? '';
    value = single;
    (onValueChange as ((v: string) => void) | undefined)?.(single);
  }
}

rootContext.set({
  get orientation() {
    return orientation;
  },
  get disabled() {
    return disabled;
  },
  isOpen: (item) => open.includes(item),
  canClose: (item) => type === 'multiple' || collapsible || !open.includes(item),
  toggle(item) {
    if (open.includes(item)) {
      if (type === 'single' && !collapsible) return;
      commit(open.filter((entry) => entry !== item));
    } else {
      commit(type === 'multiple' ? [...open, item] : [item]);
    }
  },
});

/**
 * Where an arrow, Home or End key moves among `count` triggers, or -1. Keys
 * held with a modifier (or composing text) are left to the platform.
 */
function nextIndex(event: KeyboardEvent, from: number, count: number, rtl: boolean): number {
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return -1;
  const horizontal = orientation === 'horizontal';
  const forward = horizontal ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown';
  const back = horizontal ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp';
  if (event.key === 'Home') return 0;
  if (event.key === 'End') return count - 1;
  if (event.key === forward) return from + 1 < count ? from + 1 : loop ? 0 : -1;
  if (event.key === back) return from > 0 ? from - 1 : loop ? count - 1 : -1;
  return -1;
}

function handleKeydown(event: KeyboardEvent & { currentTarget: EventTarget & HTMLElement }) {
  (onkeydown as ((e: KeyboardEvent) => void) | undefined)?.(event);
  if (event.defaultPrevented) return;
  const root = event.currentTarget;
  const own = (node: Element) => node.closest('[data-tx-accordion-root]') === root;
  // Disabled triggers are skipped: they are left out of the list.
  const triggers = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-tx-accordion-trigger]:not([disabled])')
  ).filter(own);
  const from = triggers.indexOf(event.target as HTMLButtonElement);
  if (from < 0) return;
  const rtl = (dir ?? root.ownerDocument.defaultView?.getComputedStyle(root).direction) === 'rtl';
  const next = nextIndex(event, from, triggers.length, rtl);
  if (next < 0) return;
  event.preventDefault();
  triggers[next]?.focus();
}

const partProps = $derived({
  ...rest,
  'data-tx-accordion-root': '',
  'data-orientation': orientation,
  'data-disabled': disabled ? '' : undefined,
  onkeydown: handleKeydown,
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <div bind:this={ref} {...partProps}>{@render children?.()}</div>
{/if}
