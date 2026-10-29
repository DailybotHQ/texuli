<script lang="ts">
import { createPresence, type PresenceSnapshot } from '@texuli/core/presence';
import { tick, untrack } from 'svelte';
import { type Attachment, createAttachmentKey } from 'svelte/attachments';
import { createMotionHold } from '../internal/motion-hold.ts';
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
  motionHooks,
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
let node = $state<HTMLElement | null>(null);
// Open when it is created (first render, hydration): no open animation.
let wasOpen = untrack(() => item.open);
let pendingEnter = false;
const hold = createMotionHold(
  () => motionHooks,
  (held) => {
    // The close animation ended: the panel may go (or hide, with forceMount).
    if (!held && !item.open) presence.completeExit();
  }
);
const presence = createPresence({
  present: item.open,
  forceMount: keepMounted,
  isMotionPending: hold.isMotionPending,
  onSnapshot: (next) => {
    snapshot = next;
  },
});

$effect(() => {
  const open = item.open;
  untrack(() => {
    if (open !== wasOpen) {
      wasOpen = open;
      // Before presence reads `isMotionPending`.
      if (!open) {
        pendingEnter = false;
        hold.begin(node);
      } else if (node && hold.held()) hold.enter(node);
      else if (node) {
        // Kept mounted (forceMount): play once it is shown, after this update.
        const panel = node;
        void tick().then(() => {
          if (item.open && node === panel) hold.enter(panel);
        });
      } else pendingEnter = true;
    }
    presence.setPresent(open);
  });
});
$effect(() => () => {
  hold.cancel();
  presence.dispose();
});

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
  if (pendingEnter && item.open) {
    pendingEnter = false;
    hold.enter(element);
  }
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
