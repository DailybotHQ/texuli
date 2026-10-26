<script lang="ts">
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import Button from './Button.svelte';
import type { ButtonSize, ButtonVariant } from './button-variants.ts';

type IconButtonProps = HTMLButtonAttributes &
  HTMLAnchorAttributes & {
    /** Required accessible name for the icon-only control. */
    label: string;
    variant?: ButtonVariant;
    /** Defaults to the square `icon` size; larger sizes keep the square ratio. */
    size?: ButtonSize;
    href?: string | null;
    loading?: boolean;
    autoLoading?: boolean;
    disabled?: boolean;
    class?: ClassValue;
    children?: import('svelte').Snippet;
    /** The rendered root element (bindable). */
    ref?: HTMLElement | null;
  };

let {
  label,
  variant = 'ghost',
  size = 'icon',
  loading = false,
  children,
  ref = $bindable(null),
  ...rest
}: IconButtonProps = $props();
</script>

<Button
  {...rest}
  bind:ref
  {variant}
  {size}
  {loading}
  data-icon-only="true"
  aria-label={label}
  loadingLabel={label}
>
  {@render children?.()}
</Button>
