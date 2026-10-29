<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { collapsibleContext } from './context.ts';

type CollapsibleContentProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
  /** A consumer id; the trigger's aria-controls follows it. */
  id?: string;
  class?: string;
  children?: Snippet;
} & RefProp;

let {
  id,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: CollapsibleContentProps = $props();

const context = collapsibleContext.get();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'content',
  untrack(() => id)
);
$effect(() => {
  context.claimId('content', id);
  return () => context.claimId('content', undefined);
});
</script>

<div
  bind:this={ref}
  {...rest}
  id={context.contentId}
  class={`tx-collapsible__content ${className ?? ''}`.trim()}
  data-state={context.open ? 'open' : 'closed'}
  aria-labelledby={context.triggerId}
  aria-hidden={!context.open}
  inert={!context.open}
>
  <div class="tx-collapsible__content-inner">
    {@render children?.()}
  </div>
</div>

<style>
  .tx-collapsible__content {
    display: grid;
    grid-template-rows: 1fr;
    opacity: 1;
    transition:
      grid-template-rows 180ms ease,
      opacity 180ms ease;
  }

  .tx-collapsible__content[data-state='closed'] {
    grid-template-rows: 0fr;
    opacity: 0;
  }

  .tx-collapsible__content-inner {
    min-block-size: 0;
    overflow: hidden;
  }

  @starting-style {
    .tx-collapsible__content[data-state='open'] {
      grid-template-rows: 0fr;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tx-collapsible__content {
      transition-duration: 0s;
    }
  }
</style>
