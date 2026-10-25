<script lang="ts">
import { NumberField as Primitive } from '@texuli/primitives/number-field';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type NumberPinSize, numberFieldClass } from './variants.ts';
import './number-pin.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class' | 'value'> & {
  class?: ClassValue;
  size?: NumberPinSize;
  value?: number | null;
  defaultValue?: number | null;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  snapOnStep?: boolean;
  locale?: string;
  formatOptions?: Intl.NumberFormatOptions;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  allowWheel?: boolean;
  name?: string;
  form?: string;
  id?: string;
  incrementLabel?: string;
  decrementLabel?: string;
  onValueChange?: (value: number | null) => void;
  children?: Snippet;
};

let { size = 'md', class: className, value = $bindable(), ...props }: Props = $props();
const classes = $derived(cx(numberFieldClass({ size }), className));
</script>

<Primitive.Root {...props} bind:value class={classes} data-tx-number-field="" />
