<script lang="ts">
import type { HrefTrust } from '@texuli/core/url-policy';
import { Toolbar as ToolbarPrimitive } from '@texuli/primitives/toolbar';
import type { Snippet } from 'svelte';
import { getContext } from 'svelte';
import type { HTMLAnchorAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { ToolbarStyleContext } from './style-context.ts';
import { TOOLBAR_STYLE } from './style-context.ts';
import { toolbarButtonClass } from './variants.ts';
import './toolbar.css';

type OwnProps = {
  href?: string | null;
  hrefTrust?: HrefTrust;
  class?: ClassValue;
  children?: Snippet;
  'aria-label'?: string;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

/** Extra attributes (`data-*`, `aria-*`, handlers…) land on the rendered element. */
type Props = OwnProps & Omit<HTMLAnchorAttributes, keyof OwnProps | 'children'>;

let {
  href,
  hrefTrust = 'developer',
  class: className,
  children,
  'aria-label': ariaLabel,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const style = getContext<ToolbarStyleContext | undefined>(TOOLBAR_STYLE);
const classes = $derived(
  toolbarButtonClass({
    size: style?.size ?? 'md',
    class: ['tx-toolbar__link', className],
  })
);
</script>

<ToolbarPrimitive.Link
  {...rest}
  bind:ref
  {href}
  {hrefTrust}
  aria-label={ariaLabel}
  class={classes}
>
  {@render children?.()}
</ToolbarPrimitive.Link>
