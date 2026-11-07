<script lang="ts">
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { designDefaults } from '../../internal/design-defaults.ts';
import Button from './Button.svelte';
import './icon-button.css';
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
    /**
     * A count or short status drawn as a small badge on the end corner
     * (generated content: decorative, so pair it with `badgeLabel`).
     */
    badge?: string | number;
    /**
     * Accessible text for the badge (`3 unread`): the button is named
     * `<label> (<badgeLabel>)` while the badge stays visible.
     */
    badgeLabel?: string;
    class?: ClassValue;
    children?: import('svelte').Snippet;
    /** The rendered root element (bindable). */
    ref?: HTMLElement | null;
  };

const txDefaults = designDefaults('icon-button');
let {
  label,
  variant = txDefaults().variant ?? 'ghost',
  size = txDefaults().size ?? 'icon',
  loading = false,
  badge,
  badgeLabel,
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
  aria-label={badgeLabel ? `${label} (${badgeLabel})` : label}
  data-tx-badge={badge}
  loadingLabel={label}
>
  {@render children?.()}
</Button>
