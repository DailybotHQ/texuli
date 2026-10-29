<script lang="ts">
import { PinInput as Primitive } from '@texuli/primitives/pin-input';
import type { Snippet } from 'svelte';
import type { HTMLInputAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type NumberPinSize, pinInputClass } from './variants.ts';
import './number-pin.css';

/**
 * Extra attributes (`name`, `form`, `required`, `autocomplete`, `aria-*`,
 * `data-*`, handlers…) reach the one real input, like the primitive's.
 */
type Props = Omit<
  HTMLInputAttributes,
  'children' | 'class' | 'value' | 'maxlength' | 'pattern' | 'type' | 'size'
> & {
  class?: ClassValue;
  size?: NumberPinSize;
  value?: string;
  onValueChange?: (value: string) => void;
  maxlength?: number;
  pattern?: string;
  pasteTransformer?: (text: string) => string;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  inputId?: string;
  /** The real input element (`bind:inputRef`). */
  inputRef?: HTMLInputElement | null;
  mask?: boolean;
  children?: Snippet<
    [
      {
        cells: import('@texuli/primitives/pin-input').PinCell[];
        isFocused: boolean;
        isHovering: boolean;
      },
    ]
  >;
};

let {
  size = 'md',
  class: className,
  children,
  value = $bindable(''),
  inputRef = $bindable(null),
  ...props
}: Props = $props();
const classes = $derived(cx(pinInputClass({ size }), className));
</script>

<Primitive.Root {...props} bind:value bind:inputRef class={classes}>
  {#snippet children(state)}
    <div class="tx-pin-input__cells" aria-hidden="true">
      {@render children?.(state)}
    </div>
  {/snippet}
</Primitive.Root>
