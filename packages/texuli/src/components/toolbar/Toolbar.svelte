<script lang="ts">
import { Toolbar as ToolbarPrimitive } from '@texuli/primitives/toolbar';
import type { Snippet } from 'svelte';
import { setContext } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { TOOLBAR_STYLE } from './style-context.ts';
import { type ToolbarSize, type ToolbarVariant, toolbarRootClass } from './variants.ts';
import './toolbar.css';
import { designDefaults } from '../../internal/design-defaults.ts';

type Orientation = 'horizontal' | 'vertical';

type OwnProps = {
  orientation?: Orientation;
  loop?: boolean;
  variant?: ToolbarVariant;
  size?: ToolbarSize;
  class?: ClassValue;
  children?: Snippet;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

/** Extra attributes (`data-*`, `aria-*`, handlers…) land on the rendered element. */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'children'>;

const txDefaults = designDefaults('toolbar');
let {
  orientation = 'horizontal',
  loop = true,
  variant = txDefaults().variant ?? 'default',
  size = txDefaults().size ?? 'md',
  class: className,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ref = $bindable(null),
  ...rest
}: Props = $props();

setContext(TOOLBAR_STYLE, {
  get size() {
    return size;
  },
});

const classes = $derived(
  toolbarRootClass({
    variant,
    size,
    orientation,
    class: className,
  })
);
</script>

<ToolbarPrimitive.Root
  {...rest}
  bind:ref
  {orientation}
  {loop}
  class={classes}
  aria-label={ariaLabel}
  aria-labelledby={ariaLabelledby}
>
  {@render children?.()}
</ToolbarPrimitive.Root>
