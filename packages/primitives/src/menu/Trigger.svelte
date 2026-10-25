<script lang="ts">
import { untrack } from 'svelte';
import { createAttachmentKey } from 'svelte/attachments';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import { menuLevelContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'children'> & {
  children?: import('svelte').Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
};
type Click = Parameters<NonNullable<HTMLButtonAttributes['onclick']>>[0];
type Key = Parameters<NonNullable<HTMLButtonAttributes['onkeydown']>>[0];

let { children, child, onclick, onkeydown, type = 'button', ...rest }: Props = $props();
const level = menuLevelContext.get();
// A consumer id wins: the context records it, so every reference follows.
level.claimId(
  'trigger',
  untrack(() => rest.id)
);
$effect(() => {
  level.claimId('trigger', rest.id);
  return () => level.claimId('trigger', undefined);
});

function register(node: HTMLElement): () => void {
  level.registerTrigger(node);
  return () => level.registerTrigger(undefined);
}
// Part of the trigger props, so a `child` snippet's element registers too: the
// menu needs it to anchor its content and to return focus on close.
const registerKey = createAttachmentKey();

function handleClick(event: Click): void {
  onclick?.(event);
  if (event.defaultPrevented || rest.disabled) return;
  // A pointer opens with focus on the menu itself; a keyboard click lands on the first item.
  if (level.open) level.close(false);
  else level.setOpen(true, event.detail === 0 ? 'first' : 'content');
}

function handleKeydown(event: Key): void {
  onkeydown?.(event);
  if (event.defaultPrevented || rest.disabled) return;
  const intent =
    event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown'
      ? 'first'
      : event.key === 'ArrowUp'
        ? 'last'
        : null;
  if (!intent) return;
  event.preventDefault();
  level.setOpen(true, intent);
}

const triggerProps = $derived({
  ...rest,
  id: level.triggerId,
  type,
  'aria-haspopup': 'menu' as const,
  'aria-expanded': level.open,
  'aria-controls': level.open ? level.contentId : undefined,
  'data-state': level.open ? 'open' : 'closed',
  onclick: handleClick,
  onkeydown: handleKeydown,
  [registerKey]: register,
});
</script>

{#if child}
  {@render child({ props: triggerProps })}
{:else}
  <button {...triggerProps}>
    {@render children?.()}
  </button>
{/if}
