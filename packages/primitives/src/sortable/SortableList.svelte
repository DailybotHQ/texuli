<script lang="ts">
import type { Snippet } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { sortableContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children' | 'id'> & {
  /** The container id in the root's `containers`. */
  id: string;
  /** The list's name in announcements; also its `aria-label` when none is given. */
  label?: string;
  /** Element to render. Default `ul`; trees and grids pass their role through attributes. */
  as?: 'ul' | 'ol' | 'div';
  /** Renders the items in their current (preview) order. */
  children?: Snippet<[{ items: readonly string[] }]>;
} & RefProp;

let { id, label, as = 'ul', children, ref = $bindable(null), ...rest }: Props = $props();
const context = sortableContext.get();

const items = $derived(context.order(id));
const state = $derived(context.state());
const targeted = $derived(state.phase === 'dragging' && state.target?.containerId === id);

const attach: Attachment<HTMLElement> = (node) =>
  context.registerList(id, node, label ?? rest['aria-label'] ?? undefined);
</script>

<svelte:element
  bind:this={ref}
  this={as}
  aria-label={rest['aria-label'] ?? label}
  {...rest}
  class={`tx-sortable__list ${rest.class ?? ''}`.trim()}
  data-sortable-list={id}
  data-orientation={context.container(id)?.orientation ?? 'vertical'}
  data-drop-target={targeted ? '' : undefined}
  data-refused={targeted && state.verdict && !state.verdict.ok ? '' : undefined}
  data-disabled={context.container(id)?.disabled ? '' : undefined}
  {@attach attach}
>
  {@render children?.({ items })}
</svelte:element>

<style>
  .tx-sortable__list[data-drop-target] {
    outline: 2px dashed currentColor;
    outline-offset: 2px;
  }

  .tx-sortable__list[data-refused] {
    outline-style: dotted;
  }

  @media (forced-colors: active) {
    .tx-sortable__list[data-drop-target] {
      outline-color: Highlight;
    }

    .tx-sortable__list[data-refused] {
      outline-color: GrayText;
    }
  }
</style>
