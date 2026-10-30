<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { type CodeVariant, codeClass } from './variants.ts';
import './kbd-code.css';
import { designDefaults } from '../../internal/design-defaults.ts';

/**
 * Inline or block code. Text is always escaped (Svelte text interpolation);
 * never pass HTML. Prefer the `value` prop for agent/user content.
 */
type Props = HTMLAttributes<HTMLElement> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** Plain source text (escaped on render). Takes precedence over children. */
  value?: string;
  variant?: CodeVariant;
  /** Optional language hint for block code (`data-language`). Display only. */
  language?: string;
  class?: ClassValue;
  children?: import('svelte').Snippet;
};

const txDefaults = designDefaults('code');
let {
  value = undefined,
  variant = txDefaults().variant ?? 'inline',
  language = undefined,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const classes = $derived(
  codeClass({
    variant,
    class: className,
  })
);

const text = $derived(typeof value === 'string' ? value : undefined);
</script>

{#if variant === 'block'}
  <pre
    class="tx-code-block"
    data-tx-code-block
    data-language={language || undefined}
  ><code
      bind:this={ref}
      class={classes}
      data-tx-code
      data-variant="block"
      data-language={language || undefined}
      {...rest}
      >{#if text !== undefined}{text}{:else}{@render children?.()}{/if}</code
    ></pre
  >
{:else}
  <code
    bind:this={ref}
    class={classes}
    data-tx-code
    data-variant="inline"
    data-language={language || undefined}
    {...rest}
    >{#if text !== undefined}{text}{:else}{@render children?.()}{/if}</code
  >
{/if}
