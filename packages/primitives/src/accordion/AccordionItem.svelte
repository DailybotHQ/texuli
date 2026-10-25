<script lang="ts">
import { itemContext, partAttributes, rootContext } from './context.ts';
import type { AccordionItemProps } from './types.ts';

let {
  value,
  disabled = false,
  child,
  children,
  ref = $bindable(null),
  ...rest
}: AccordionItemProps = $props();

const root = rootContext.get();
// Page-unique and stable between the server and the client.
const uid = $props.id();
/** Consumer ids claimed by the trigger and content; they win over the generated ones. */
let claimedIds = $state<{ trigger?: string; content?: string }>({});

const item = itemContext.set({
  get value() {
    return value;
  },
  get open() {
    return root.isOpen(value);
  },
  get disabled() {
    return root.disabled || disabled;
  },
  get orientation() {
    return root.orientation;
  },
  get canClose() {
    return root.canClose(value);
  },
  get triggerId() {
    return claimedIds.trigger || `${uid}-trigger`;
  },
  get contentId() {
    return claimedIds.content || `${uid}-content`;
  },
  claimId(part, id) {
    claimedIds[part] = id || undefined;
  },
  toggle: () => root.toggle(value),
});

const partProps = $derived({ ...rest, ...partAttributes(item) });
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <div bind:this={ref} {...partProps}>{@render children?.()}</div>
{/if}
