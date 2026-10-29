<script lang="ts">
import { Tooltip as TooltipPrimitive } from '@texuli/primitives/tooltip';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { Kbd } from '../kbd-code/index.ts';
import { type TooltipAlign, type TooltipSide, tooltipContentClass } from './variants.ts';
import './tooltip.css';

type TriggerSnippet = Snippet<[{ props: Record<string, unknown> }]>;

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class' | 'content'> & {
  /** The tooltip element (bindable; `null` while hidden). Other attributes land on it too. */
  ref?: HTMLElement | null;
  /** Tooltip text, or a snippet for rich content. */
  content: string | Snippet;
  /**
   * Trigger. Spread `props` onto a focusable element:
   * `{#snippet children({ props })}<button {...props}>…`
   */
  children: TriggerSnippet;
  /** Optional keyboard shortcut hints (shown as Kbd chips). */
  shortcut?: string | readonly string[];
  side?: TooltipSide;
  align?: TooltipAlign;
  sideOffset?: number;
  delayDuration?: number;
  disabled?: boolean;
  open?: boolean;
  class?: ClassValue;
};

let {
  content,
  children,
  shortcut,
  side = 'top',
  align = 'center',
  sideOffset = 6,
  delayDuration = 300,
  disabled = false,
  open = $bindable(false),
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const shortcuts = $derived(
  shortcut === undefined
    ? []
    : typeof shortcut === 'string'
      ? shortcut.trim() === ''
        ? []
        : [shortcut]
      : [...shortcut].filter((part) => part.trim() !== '')
);

const contentClass = $derived(
  tooltipContentClass({
    side,
    class: className,
  })
);
</script>

<!-- Local provider: usable without app-level setup. -->
<TooltipPrimitive.Provider {delayDuration}>
  <TooltipPrimitive.Root bind:open {disabled}>
    <TooltipPrimitive.Trigger>
      {#snippet child({ props })}
        {@render children({ props })}
      {/snippet}
    </TooltipPrimitive.Trigger>
    <TooltipPrimitive.Content
      bind:ref
      {...rest}
      {side}
      {align}
      {sideOffset}
      class={contentClass}
      data-tx-tooltip
    >
      <span class="tx-tooltip__body">
        <span class="tx-tooltip__text">
          {#if typeof content === 'string'}
            {content}
          {:else}
            {@render content()}
          {/if}
        </span>
        {#if shortcuts.length > 0}
          <span class="tx-tooltip__shortcuts" data-tx-tooltip-shortcuts aria-hidden="true">
            {#each shortcuts as key (key)}
              <Kbd>{key}</Kbd>
            {/each}
          </span>
        {/if}
      </span>
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Root>
</TooltipPrimitive.Provider>
