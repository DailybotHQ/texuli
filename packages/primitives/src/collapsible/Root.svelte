<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import { type CollapsibleContextValue, collapsibleContext } from './context.ts';

interface CollapsibleRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  id?: string;
  class?: string;
  onOpenChange?: (open: boolean) => void;
  children?: Snippet;
}

let {
  open = $bindable(),
  defaultOpen = false,
  disabled = false,
  id,
  class: className,
  onOpenChange,
  children,
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
  id={id ?? generatedId}
  class={className}
  data-state={currentOpen ? 'open' : 'closed'}
  data-disabled={disabled ? '' : undefined}
>
  {@render children?.()}
</div>
