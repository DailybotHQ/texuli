<script lang="ts">
import type { IconComponent } from '../../components/icons/types.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { navIconPath } from './nav-icons.ts';
import type { NavIconRef } from './nav-model.ts';

/**
 * Renders a nav icon: a built-in glyph by name (each known name has its own
 * drawing; other names get a neutral dot, never the menu glyph), or any
 * Svelte SVG component (for example a Lucide icon the app imports).
 */

type Props = {
  icon?: NavIconRef;
  class?: ClassValue;
  label?: string;
};

let { icon, class: className, label }: Props = $props();

const component = $derived(typeof icon === 'function' ? (icon as IconComponent) : undefined);
const glyph = $derived(typeof icon === 'string' ? navIconPath(icon) : undefined);
</script>

{#if component}
  {@const Glyph = component}
  <Glyph
    class={cx('tx-layout-nav-icon', className)}
    size={16}
    aria-hidden={label ? undefined : true}
    aria-label={label}
    data-tx-nav-icon=""
  />
{:else if glyph && typeof icon === 'string'}
  <svg
    class={cx('tx-layout-nav-icon', className)}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false"
    aria-hidden={label ? undefined : 'true'}
    role={label ? 'img' : undefined}
    aria-label={label}
    data-tx-nav-icon={icon}
    data-known={glyph.known ? 'true' : 'false'}
  >
    <path d={glyph.path} />
  </svg>
{/if}
