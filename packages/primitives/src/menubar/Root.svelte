<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import { type MenubarMenuEntry, menubarContext } from './context.ts';

/**
 * Menubar root (APG Menubar): a horizontal `role="menubar"` of triggers, one
 * of which is in the Tab order (roving tabindex). ArrowLeft and ArrowRight
 * move between triggers, and carry an open menu along; once one menu is open,
 * hovering another trigger switches to it.
 */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'dir'> & {
  /** The open menu's value, or `''` (bindable). */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Arrow keys wrap from the last trigger to the first. Default `true`. */
  loop?: boolean;
  /** Text direction. Default: the root's resolved direction. */
  dir?: 'ltr' | 'rtl';
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
  ref?: HTMLElement | null;
};

let {
  value = $bindable(''),
  onValueChange,
  loop = true,
  dir,
  child,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const menus = new Map<string, MenubarMenuEntry>();
let order = $state<string[]>([]);
let tabStop = $state<string | undefined>(undefined);

function enabled(): string[] {
  return order.filter((entry) => !menus.get(entry)?.disabled());
}

menubarContext.set({
  get value() {
    return value;
  },
  setValue(next) {
    if (next === value) return;
    value = next;
    onValueChange?.(next);
  },
  get tabStop() {
    return tabStop ?? enabled()[0];
  },
  setTabStop(next) {
    tabStop = next;
  },
  register(entry, menu) {
    // Called from a trigger's effect: untracked, so the effect depends only
    // on the trigger's own value, not on the list it updates.
    untrack(() => {
      menus.set(entry, menu);
      order = [...order, entry];
    });
    return () =>
      untrack(() => {
        menus.delete(entry);
        order = order.filter((other) => other !== entry);
      });
  },
  neighbor(from, steps) {
    const list = enabled();
    if (list.length === 0) return undefined;
    if (steps === 'first') return list[0];
    if (steps === 'last') return list[list.length - 1];
    const index = list.indexOf(from) + steps;
    if (index >= 0 && index < list.length) return list[index];
    return loop ? list[(index + list.length) % list.length] : undefined;
  },
  move(to, open, intent) {
    const menu = menus.get(to);
    if (!menu) return;
    tabStop = to;
    if (open) menu.level.setOpen(true, intent);
    else menu.trigger()?.focus();
  },
  isRtl(node) {
    return (dir ?? node.ownerDocument.defaultView?.getComputedStyle(node).direction) === 'rtl';
  },
});

const partProps = $derived({
  ...rest,
  role: 'menubar',
  'aria-orientation': 'horizontal' as const,
  dir,
  'data-state': value ? 'open' : 'closed',
  'data-tx-menubar': '',
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <div bind:this={ref} {...partProps}>{@render children?.()}</div>
{/if}
