<script lang="ts">
import { Value as PrimitiveValue } from '@texuli/primitives/select';
import type { ComponentProps } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { selectValueClass } from './variants.ts';

type Props = ComponentProps<typeof PrimitiveValue> & {
  class?: ClassValue;
};

// The prop is renamed: the `{#snippet children}` below would shadow it,
// and rendering it would then recurse into the snippet itself.
let { class: className, placeholder = 'Select…', children: content, ...rest }: Props = $props();
</script>

<PrimitiveValue {placeholder} {...rest}>
  {#snippet children({ value, label })}
    <span
      class={selectValueClass({
        class: className,
        placeholder: !label,
      })}
      data-tx-select-value
      data-placeholder={!label ? '' : undefined}
    >
      {#if content}
        {@render content({ value, label })}
      {:else}
        {label || placeholder}
      {/if}
    </span>
  {/snippet}
</PrimitiveValue>
