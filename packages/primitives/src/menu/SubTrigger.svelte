<script lang="ts">
import { onDestroy, type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { menuLevelContext } from './context.ts';
import { graceArea } from './grace.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  disabled?: boolean;
  textValue?: string;
  /** Milliseconds a pointer rests before the submenu opens. Default 100. */
  openDelay?: number;
  children?: Snippet;
};

let { disabled = false, textValue, openDelay = 100, children, ...rest }: Props = $props();
const sub = menuLevelContext.get();
// A consumer id wins: the context records it, so every reference follows.
sub.claimId(
  'trigger',
  untrack(() => rest.id)
);
$effect(() => {
  sub.claimId('trigger', rest.id);
  return () => sub.claimId('trigger', undefined);
});
const parent = sub.parent;
let highlighted = $state(false);
let timer: ReturnType<typeof setTimeout> | undefined;
onDestroy(() => clearTimeout(timer));

const rtl = (node: Element) => getComputedStyle(node).direction === 'rtl';

function register(node: HTMLElement): () => void {
  sub.registerTrigger(node);
  return () => sub.registerTrigger(undefined);
}

function openFromKeyboard(event: KeyboardEvent & { currentTarget: HTMLElement }): void {
  if (disabled) return;
  const openKey = rtl(event.currentTarget) ? 'ArrowLeft' : 'ArrowRight';
  if (event.key !== openKey && event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.stopPropagation();
  clearTimeout(timer);
  if (sub.open && sub.contentElement) {
    sub.focusIntent = 'first';
    sub.contentElement
      .querySelector<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')
      ?.focus();
  } else sub.setOpen(true, 'first');
}

function pointerEnter(event: PointerEvent): void {
  if (event.pointerType !== 'mouse' || disabled) return;
  if (parent) parent.grace = null;
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!sub.open) sub.setOpen(true, null);
  }, openDelay);
}

function pointerLeave(event: PointerEvent): void {
  if (event.pointerType !== 'mouse') return;
  clearTimeout(timer);
  const content = sub.contentElement;
  if (!sub.open || !content || !parent) return;
  const rect = content.getBoundingClientRect();
  const side =
    rect.left >= (event.currentTarget as HTMLElement).getBoundingClientRect().right - 1
      ? 'right'
      : 'left';
  parent.grace = {
    polygon: graceArea({ x: event.clientX, y: event.clientY }, rect, side),
    until: Date.now() + 300,
  };
}
</script>

<div
  {...rest}
  id={sub.triggerId}
  role="menuitem"
  tabindex="-1"
  aria-haspopup="menu"
  aria-expanded={sub.open}
  aria-controls={sub.open ? sub.contentId : undefined}
  aria-disabled={disabled ? 'true' : undefined}
  data-state={sub.open ? 'open' : 'closed'}
  data-disabled={disabled ? '' : undefined}
  data-highlighted={highlighted ? '' : undefined}
  data-typeahead={textValue}
  onfocus={() => (highlighted = true)}
  onblur={() => (highlighted = false)}
  onkeydown={openFromKeyboard}
  onpointerenter={pointerEnter}
  onpointerleave={pointerLeave}
  onclick={() => {
    if (!disabled && !sub.open) sub.setOpen(true, 'first');
  }}
  {@attach register}
>
  {@render children?.()}
</div>
