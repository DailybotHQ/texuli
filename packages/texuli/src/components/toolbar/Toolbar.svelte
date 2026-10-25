<script lang="ts">
import { Toolbar as ToolbarPrimitive } from '@texuli/primitives/toolbar';
import type { Snippet } from 'svelte';
import { setContext } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { TOOLBAR_STYLE } from './style-context.ts';
import { type ToolbarSize, type ToolbarVariant, toolbarRootClass } from './variants.ts';
import './toolbar.css';

type Orientation = 'horizontal' | 'vertical';

type Props = {
  orientation?: Orientation;
  loop?: boolean;
  variant?: ToolbarVariant;
  size?: ToolbarSize;
  class?: ClassValue;
  children?: Snippet;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

let {
  orientation = 'horizontal',
  loop = true,
  variant = 'default',
  size = 'md',
  class: className,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
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
  {orientation}
  {loop}
  class={classes}
  aria-label={ariaLabel}
  aria-labelledby={ariaLabelledby}
>
  {@render children?.()}
</ToolbarPrimitive.Root>
