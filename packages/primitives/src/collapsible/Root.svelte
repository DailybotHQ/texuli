<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type CollapsibleContextValue, collapsibleContext } from './context.ts';

interface CollapsibleRootOwnProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  id?: string;
  class?: string;
  onOpenChange?: (open: boolean) => void;
  children?: Snippet;
  /** The root element (bindable). */
  ref?: HTMLElement | null;
}

/** Extra attributes (`data-*`, `aria-*`, handlers…) land on the root element. */
type CollapsibleRootProps = CollapsibleRootOwnProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof CollapsibleRootOwnProps>;

let {
  open = $bindable(),
  defaultOpen = false,
  disabled = false,
  id,
  class: className,
  onOpenChange,
  children,
  ref = $bindable(null),
  ...rest
}: CollapsibleRootProps = $props();

const initialOpen = open;
const controlled = initialOpen !== undefined;
const generatedId = $props.id();
const initialValue = untrack(() => initialOpen ?? defaultOpen);
let localOpen = $state(initialValue);
const currentOpen = $derived(open ?? localOpen);

function setOpen(next: boolean): void {
  if (disabled || currentOpen === next) return;
  if (controlled) {
    open = next;
  } else {
    localOpen = next;
    open = next;
  }
  onOpenChange?.(next);
}

/** Consumer ids claimed by the trigger and content; they win over the generated ones. */
let claimedIds = $state<{ trigger?: string; content?: string }>({});
const baseId = $derived(id ?? generatedId);

const context: CollapsibleContextValue = {
  get open() {
    return currentOpen;
  },
  get disabled() {
    return Boolean(disabled);
  },
  get triggerId() {
    return claimedIds.trigger || `${baseId}-trigger`;
  },
  get contentId() {
    return claimedIds.content || `${baseId}-content`;
  },
  claimId(part, claimed) {
    claimedIds[part] = claimed || undefined;
  },
  toggle() {
    setOpen(!currentOpen);
  },
};

collapsibleContext.set(context);
</script>

<div
  bind:this={ref}
  {...rest}
  id={id ?? generatedId}
  class={className}
  data-state={currentOpen ? 'open' : 'closed'}
  data-disabled={disabled ? '' : undefined}
>
  {@render children?.()}
</div>
