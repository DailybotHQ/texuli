<script lang="ts">
import type { Snippet } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';
import { sortableContext, sortableItemContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children' | 'id'> & {
  /** The item id in its container's `items`. */
  id: string;
  /** The item's name in announcements and its handle's default accessible name. Plain text. */
  label?: string;
  /** Element to render. Default `li`. */
  as?: 'li' | 'div';
  children?: Snippet<[{ dragging: boolean; selected: boolean; locked: boolean }]>;
};

let { id, label, as = 'li', children, ...rest }: Props = $props();
const context = sortableContext.get();
sortableItemContext.set({ id: () => id, label: () => label });

const dragging = $derived(context.isDragging(id));
const selected = $derived(context.isSelected(id));
const locked = $derived(context.isLocked(id));
const indicator = $derived(context.indicator(id));
const translate = $derived(context.translate(id));

const attach: Attachment<HTMLElement> = (node) => context.registerItem(id, node, label);
</script>

<svelte:element
  this={as}
  {...rest}
  class={`tx-sortable__item ${rest.class ?? ''}`.trim()}
  data-sortable-item={id}
  data-dragging={dragging ? '' : undefined}
  data-selected={selected ? '' : undefined}
  data-locked={locked ? '' : undefined}
  data-drop-indicator={indicator ?? undefined}
  style:translate={translate}
  {@attach attach}
>
  {@render children?.({ dragging, selected, locked })}
</svelte:element>

<style>
  .tx-sortable__item[data-dragging] {
    outline: 2px solid currentColor;
    outline-offset: -2px;
  }

  .tx-sortable__item[style*='translate'] {
    position: relative;
    z-index: 1;
  }

  .tx-sortable__item[data-drop-indicator] {
    position: relative;
  }

  .tx-sortable__item[data-drop-indicator]::before {
    content: '';
    position: absolute;
    inset-inline: 0;
    border-block-start: 2px solid currentColor;
    pointer-events: none;
  }

  .tx-sortable__item[data-drop-indicator='before']::before {
    inset-block-start: -1px;
  }

  .tx-sortable__item[data-drop-indicator='after']::before {
    inset-block-end: -1px;
  }

  @media (forced-colors: active) {
    .tx-sortable__item[data-dragging] {
      outline-color: Highlight;
    }

    .tx-sortable__item[data-drop-indicator]::before {
      border-color: Highlight;
    }
  }
</style>
