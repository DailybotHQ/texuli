<script lang="ts">
import {
  Splitter,
  type SplitterDirection,
  type SplitterStorage,
} from '@texuli/primitives/splitter';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { type ResizableVariant, resizableGroupClass } from './variants.ts';
import './resizable.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

/**
 * A styled group of resizable panels (the APG window splitter, from
 * `@texuli/primitives/splitter`). Put `ResizablePanel`s and `ResizableHandle`s
 * inside, alternating.
 */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
  /** `horizontal`: panels side by side. `vertical`: stacked. */
  direction?: SplitterDirection;
  /** Panel sizes in percent. Bindable. */
  layout?: number[];
  onLayoutChange?: (layout: number[]) => void;
  /** Restore and save the layout under this key in `storage`. */
  autoSaveId?: string;
  storage?: SplitterStorage;
  /** Percent per arrow press. Default 10. */
  keyboardStep?: number;
  disabled?: boolean;
  /** `plain` (default) or `bordered`: a framed surface. */
  variant?: ResizableVariant;
  class?: ClassValue;
  ref?: HTMLElement | null;
  children?: Snippet;
};

let {
  direction = 'horizontal',
  layout = $bindable(),
  variant: variantProp,
  class: className,
  ref = $bindable(null),
  children,
  ...rest
}: Props = $props();
const txDefaults = designDefaults('resizable');
const variant = $derived(withDefault(variantProp, txDefaults().variant, 'plain'));
</script>

<Splitter.Root
  {...rest}
  {direction}
  bind:layout
  bind:ref
  class={resizableGroupClass({ variant, class: className })}
  data-tx-resizable=""
>
  {@render children?.()}
</Splitter.Root>
