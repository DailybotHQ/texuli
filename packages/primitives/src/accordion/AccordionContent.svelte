<script lang="ts">
import { createPresence, type PresenceSnapshot } from '@texuli/core/presence';
import { untrack } from 'svelte';
import { type Attachment, createAttachmentKey } from 'svelte/attachments';
import { itemContext, partAttributes } from './context.ts';
import type { AccordionContentProps } from './types.ts';

/**
 * The panel: a labelled region. It stays mounted until its exit animation
 * ends (presence), and exposes its natural size as
 * `--tx-accordion-content-height` and `--tx-accordion-content-width` so CSS
 * can animate opening and closing.
 */
let {
  forceMount = false,
  child,
  children,
  ref = $bindable(null),
  ...rest
}: AccordionContentProps = $props();

const item = itemContext.get();
// A consumer id wins: the context records it, so every reference follows.
item.claimId(
  'content',
  untrack(() => rest.id)
);
$effect(() => {
  item.claimId('content', rest.id);
  return () => item.claimId('content', undefined);
});
// Presence reads `forceMount` once, when the panel is created.
const keepMounted = untrack(() => forceMount);
let snapshot = $state<PresenceSnapshot>({
  mounted: item.open || keepMounted,
  state: item.open ? 'open' : 'closed',
  exiting: false,
  present: item.open,
});
const presence = createPresence({
  present: item.open,
  forceMount: keepMounted,
  onSnapshot: (next) => {
    snapshot = next;
  },
});
let node = $state<HTMLElement | null>(null);

$effect(() => presence.setPresent(item.open));
$effect(() => () => presence.dispose());

// Measure on every open or close, so an animation starts from the real size.
$effect(() => {
  void item.open;
  if (!node) return;
  node.style.setProperty('--tx-accordion-content-height', `${node.scrollHeight}px`);
  node.style.setProperty('--tx-accordion-content-width', `${node.scrollWidth}px`);
});

// One key for the component's lifetime: a new key per render would make Svelte
// detach and re-attach, which ends a running exit animation.
const attachKey = createAttachmentKey();
const attach: Attachment<HTMLElement> = (element) => {
  node = element;
  ref = element;
  presence.setNode(element);
  return () => {
    presence.setNode(null);
    node = null;
  };
};

const partProps = $derived({
  ...rest,
  ...partAttributes(item),
  'data-state': snapshot.state,
  id: item.contentId,
  role: 'region',
  'aria-labelledby': item.triggerId,
  // Hidden only once presence says the panel is fully closed (matters with
  // forceMount). Reading `item.open` here would hide the panel before its exit
  // animation starts, and `display: none` cancels the animation.
  hidden: (snapshot.state === 'closed' && !snapshot.exiting) || undefined,
  [attachKey]: attach,
});
</script>

{#if snapshot.mounted || keepMounted}
  {#if child}
    {@render child({ props: partProps })}
  {:else}
    <div {...partProps}>{@render children?.()}</div>
  {/if}
{/if}
