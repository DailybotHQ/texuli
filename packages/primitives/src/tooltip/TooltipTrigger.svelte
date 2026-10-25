<script lang="ts">
import { getContext, onMount, type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import { TOOLTIP_CONTEXT, type TooltipContext } from './context.ts';

interface TriggerNodeProps extends Record<string, unknown> {
  id: string;
  'aria-describedby'?: string;
  'data-state': 'open' | 'closed';
  'data-disabled'?: '';
  disabled?: boolean;
  onpointerenter: (event: PointerEvent) => void;
  onpointerleave: (event: PointerEvent) => void;
  onpointerdown: (event: PointerEvent) => void;
  onpointerup: (event: PointerEvent) => void;
  onpointercancel: (event: PointerEvent) => void;
  onfocusin: () => void;
  onfocusout: (event: FocusEvent) => void;
}

interface Props extends HTMLAttributes<HTMLElement> {
  child?: ChildSnippet<TriggerNodeProps>;
  children?: Snippet;
  disabled?: boolean;
}

let { child, children, disabled: triggerDisabled = false, ...rest }: Props = $props();
const tooltip = getContext<TooltipContext>(TOOLTIP_CONTEXT);
// A consumer id wins: the context records it, so every reference follows.
tooltip.claimId(
  'trigger',
  untrack(() => rest.id)
);
$effect(() => {
  tooltip.claimId('trigger', rest.id);
  return () => tooltip.claimId('trigger', undefined);
});

const primitiveProps = $derived<TriggerNodeProps>({
  id: tooltip.triggerId,
  'aria-describedby': tooltip.isOpen() ? tooltip.contentId : undefined,
  'data-state': tooltip.isOpen() ? 'open' : 'closed',
  'data-disabled': tooltip.isDisabled() ? '' : undefined,
  disabled: tooltip.isDisabled(),
  onpointerenter: (event) => {
    if (!triggerDisabled && rest['aria-disabled'] !== 'true') tooltip.pointerEnter(event);
  },
  onpointerleave: (event) => tooltip.pointerLeave(event),
  onpointerdown: (event) => {
    if (!triggerDisabled && rest['aria-disabled'] !== 'true') tooltip.pointerDown(event);
  },
  onpointerup: (event) => tooltip.pointerUp(event),
  onpointercancel: (event) => tooltip.pointerUp(event),
  onfocusin: () => {
    if (!triggerDisabled && rest['aria-disabled'] !== 'true') tooltip.focusIn();
  },
  onfocusout: (event) => {
    const current = event.currentTarget;
    const next = event.relatedTarget;
    if (current instanceof HTMLElement && next instanceof Node && current.contains(next)) return;
    tooltip.focusOut();
  },
});

const forwarded = $derived.by(() => {
  const merged = composeChildProps(primitiveProps, rest as Partial<TriggerNodeProps>);
  merged.id = tooltip.triggerId;
  merged['aria-describedby'] =
    [rest['aria-describedby'], tooltip.isOpen() ? tooltip.contentId : undefined]
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
      .join(' ') || undefined;
  merged['data-state'] = tooltip.isOpen() ? 'open' : 'closed';
  merged['data-disabled'] = tooltip.isDisabled() ? '' : undefined;
  merged.disabled = Boolean(triggerDisabled || tooltip.isDisabled());
  return merged;
});

onMount(() => {
  const trigger = document.getElementById(tooltip.triggerId);
  if (!(trigger instanceof HTMLElement)) return;
  tooltip.setTrigger(trigger);
  return () => tooltip.setTrigger(null);
});
</script>

{#if child}
  {@render child({ props: forwarded })}
{:else}
  <button {...forwarded}>{@render children?.()}</button>
{/if}
