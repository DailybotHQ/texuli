<script lang="ts">
import type { HTMLButtonAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue } from '../../internal/cx.ts';
import { type CommandSize, type CommandVariant, commandTriggerClass } from './variants.ts';
import './command.css';

type Props = Omit<HTMLButtonAttributes, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** Visible prompt text. */
  label?: string;
  /** Keys shown after the label (e.g. ['⌘', 'K']). */
  keys?: readonly string[];
  size?: CommandSize;
  variant?: CommandVariant;
  /** A leading search glyph, so the trigger reads as a search field. */
  icon?: boolean;
  /**
   * `narrow`: below 30rem only the glyph shows, for slim headers on phones.
   * The label is hidden visually but stays in the button, so it remains the
   * accessible name. Implies `icon`.
   */
  collapse?: 'never' | 'narrow';
  class?: ClassValue;
  children?: import('svelte').Snippet;
};

let {
  label: labelProp,
  keys = ['⌘', 'K'],
  size = 'md',
  variant = 'outline',
  icon = false,
  collapse = 'never',
  type = 'button',
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const label = $derived(labelProp ?? msg('texuli.command-trigger.label', 'Search commands…'));

const classes = $derived(
  commandTriggerClass({
    size,
    variant,
    class: className,
  })
);
</script>

<button
  bind:this={ref}
  class={classes}
  data-tx-command-trigger
  data-size={size}
  data-variant={variant}
  data-collapse={collapse === 'narrow' ? 'narrow' : undefined}
  {type}
  {...rest}
>
  {#if children}
    {@render children()}
  {:else}
    {#if icon || collapse === 'narrow'}
      <svg class="tx-command-trigger__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="7"></circle>
        <path d="m20 20-3.5-3.5"></path>
      </svg>
    {/if}
    <span class="tx-command-trigger__label">{label}</span>
    {#if keys.length > 0}
      <span class="tx-command-trigger__keys" aria-hidden="true">
        {#each keys as key (key)}
          <kbd class="tx-command-trigger__key">{key}</kbd>
        {/each}
      </span>
    {/if}
  {/if}
</button>
