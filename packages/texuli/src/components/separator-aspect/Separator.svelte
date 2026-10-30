<script lang="ts">
import {
  type SeparatorOrientation as PrimitiveOrientation,
  Separator as SeparatorPrimitive,
} from '@texuli/primitives/separator';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { type SeparatorOrientation, type SeparatorVariant, separatorClass } from './variants.ts';
import './separator-aspect.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'> & {
  /** Default `horizontal`. */
  orientation?: SeparatorOrientation;
  /**
   * Visual-only divider hidden from assistive technology. Default `true`
   * (layout chrome). Set `false` for a semantic section boundary.
   */
  decorative?: boolean;
  /** Line weight / contrast. */
  variant?: SeparatorVariant;
  /** The rendered element (bindable). */
  ref?: HTMLElement | null;
  class?: ClassValue;
};

let {
  orientation = 'horizontal',
  decorative = true,
  variant: variantProp,
  ref = $bindable(null),
  class: className,
  ...rest
}: Props = $props();
const txDefaults = designDefaults('separator');
const variant = $derived(withDefault(variantProp, txDefaults().variant, 'default'));

const classes = $derived(
  separatorClass({
    orientation,
    variant,
    class: className,
  })
);

const primitiveOrientation = $derived(orientation as PrimitiveOrientation);
</script>

<SeparatorPrimitive.Root
  bind:ref
  orientation={primitiveOrientation}
  {decorative}
  class={classes}
  data-tx-separator
  data-variant={variant}
  {...rest}
/>
