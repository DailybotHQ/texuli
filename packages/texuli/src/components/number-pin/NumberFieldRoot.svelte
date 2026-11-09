<script lang="ts">
import { NumberField as Primitive } from '@texuli/primitives/number-field';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import { type NumberPinSize, numberFieldClass } from './variants.ts';
import './number-pin.css';
import { designDefaults } from '../../internal/design-defaults.ts';

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
  /**
   * When typed text commits and `onValueChange` runs: `input` on every
   * keystroke that parses, `blur` on blur only, `enter` (default) on Enter
   * and on blur. Steppers and arrow keys commit at once in every mode.
   */
  commit?: 'input' | 'blur' | 'enter';
  /**
   * `output` shows the value read-only as plain formatted text (same
   * `locale` and `formatOptions`): the input is `readonly`, keeps its name
   * and focus, and the field drops its border and steppers. Default `input`.
   */
  display?: 'input' | 'output';
  children?: Snippet;
};

const txDefaults = designDefaults('number-field');
let {
  size = txDefaults().size ?? 'md',
  class: className,
  value = $bindable(),
  display,
  ref = $bindable(null),
  ...props
}: Props & RefProp = $props();
const classes = $derived(
  cx(numberFieldClass({ size }), display === 'output' && 'tx-number-field--output', className)
);
</script>

<Primitive.Root
  bind:ref
  {...props}
  readOnly={props.readOnly || display === 'output'}
  bind:value
  class={classes}
  data-tx-component="number-field"
  data-tx-size={size}
  data-tx-number-field=""
/>
