<script lang="ts">
import { PinInput as Primitive } from '@texuli/primitives/pin-input';
import type { Snippet } from 'svelte';
import type { HTMLInputAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import { type NumberPinSize, pinInputClass } from './variants.ts';
import './number-pin.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

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
  size: sizeProp,
  class: className,
  children,
  value = $bindable(''),
  inputRef = $bindable(null),
  ref = $bindable(null),
  ...props
}: Props & RefProp = $props();
const txDefaults = designDefaults('pin-input');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));
const classes = $derived(cx(pinInputClass({ size }), className));
</script>

<Primitive.Root bind:ref {...props} bind:value bind:inputRef class={classes}>
  {#snippet children(state)}
    <div class="tx-pin-input__cells" aria-hidden="true">
      {@render children?.(state)}
    </div>
  {/snippet}
</Primitive.Root>
