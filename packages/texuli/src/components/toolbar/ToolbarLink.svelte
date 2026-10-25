<script lang="ts">
import type { HrefTrust } from '@texuli/core/url-policy';
import { Toolbar as ToolbarPrimitive } from '@texuli/primitives/toolbar';
import type { Snippet } from 'svelte';
import { getContext } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import type { ToolbarStyleContext } from './style-context.ts';
import { TOOLBAR_STYLE } from './style-context.ts';
import { toolbarButtonClass } from './variants.ts';
import './toolbar.css';

type Props = {
  href?: string | null;
  hrefTrust?: HrefTrust;
  class?: ClassValue;
  children?: Snippet;
  'aria-label'?: string;
};

let {
  href,
  hrefTrust = 'developer',
  class: className,
  children,
  'aria-label': ariaLabel,
}: Props = $props();

const style = getContext<ToolbarStyleContext | undefined>(TOOLBAR_STYLE);
const classes = $derived(
  toolbarButtonClass({
    size: style?.size ?? 'md',
    class: ['tx-toolbar__link', className],
  })
);
</script>

<ToolbarPrimitive.Link {href} {hrefTrust} aria-label={ariaLabel} class={classes}>
  {@render children?.()}
</ToolbarPrimitive.Link>
