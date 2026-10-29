<script lang="ts">
import { formatDragMessage } from '@texuli/drag/messages';
import type { Snippet } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { sortableContext, sortableItemContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'children' | 'type'> & {
  /** Accessible name. Default: the item's label. */
  label?: string;
  children?: Snippet;
} & RefProp;

let { label, children, ref = $bindable(null), ...rest }: Props = $props();
const context = sortableContext.get();
const item = sortableItemContext.get();

const id = $derived(item.id());
const messages = $derived(context.messages());
const roleDescription = $derived(formatDragMessage(messages.roleDescription, {}));
const locked = $derived(context.isLocked(id));
const pressed = $derived(context.isDragging(id));

const attach: Attachment<HTMLElement> = (node) => {
  const unregister = context.registerHandle(id, node);
  const detach = context.pointer(id)(node);
  return () => {
    unregister();
    if (typeof detach === 'function') detach();
  };
};
</script>

<button bind:this={ref}
  type="button"
  {...rest}
  class={`tx-sortable__handle ${rest.class ?? ''}`.trim()}
  aria-label={label ?? item.label() ?? rest['aria-label']}
  aria-roledescription={roleDescription}
  aria-describedby={[context.instructionsId, rest['aria-describedby']].filter(Boolean).join(' ')}
  aria-disabled={locked ? 'true' : undefined}
  data-dragging={pressed ? '' : undefined}
  onkeydown={(event) => {
    rest.onkeydown?.(event);
    if (!event.defaultPrevented) context.keydown(id, event, event.currentTarget);
  }}
  {@attach attach}
>
  {@render children?.()}
</button>

<style>
  .tx-sortable__handle {
    min-inline-size: 24px;
    min-block-size: 24px;
    touch-action: none;
    cursor: grab;
  }

  .tx-sortable__handle[data-dragging] {
    cursor: grabbing;
  }

  .tx-sortable__handle[aria-disabled='true'] {
    cursor: not-allowed;
  }

  .tx-sortable__handle:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  @media (forced-colors: active) {
    .tx-sortable__handle:focus-visible {
      outline-color: Highlight;
    }
  }
</style>
