<script lang="ts">
import { createAttachmentKey } from 'svelte/attachments';
import type { SVGAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { ICON_SIZES, iconClass } from './icon-variants.ts';
import { iconPath, isIconName } from './icons.ts';
import type { IconComponentProps, IconRef, IconSize } from './types.ts';

type Props = Omit<SVGAttributes<SVGSVGElement>, 'class' | 'color'> & {
  /** One of the built-in icons or a Svelte SVG component (such as a Lucide icon). */
  icon?: IconRef;
  size?: IconSize;
  /** Passed through to custom/Lucide components; Lucide accepts number | string. */
  strokeWidth?: number | string;
  /** Optional color; `null` is normalized away before spreading onto Lucide. */
  color?: string | null;
  class?: ClassValue;
  /** Adds an accessible image name; without it the icon is decorative. */
  label?: string;
};

let {
  icon,
  size = 'md',
  strokeWidth,
  color = undefined,
  label,
  class: className,
  'aria-label': ariaLabel,
  ref = $bindable(null),
  ...rest
}: Props & {
  /** The rendered `<svg>` (bindable). */
  ref?: SVGSVGElement | null;
} = $props();

const pixelSize = $derived(ICON_SIZES[size]);
/** An explicit `strokeWidth` wins over the `--tx-icon-stroke-width` token (icons.css). */
const strokeAttr = $derived(strokeWidth ?? 2);
const strokeMark = $derived(strokeWidth === undefined ? undefined : 'custom');
const name = $derived(typeof icon === 'string' && isIconName(icon) ? icon : undefined);
const component = $derived(typeof icon === 'function' ? icon : undefined);
const path = $derived(name ? iconPath(name) : undefined);
const accessibleName = $derived(label ?? ariaLabel);
const classes = $derived(iconClass({ size, class: className }));
/** Lucide-safe color: drop null so Component props stay assignable. */
const glyphColor = $derived(color === null || color === undefined ? undefined : color);

/**
 * Props for a custom Glyph. Built as a plain object so the spread stays a
 * finite type (avoiding Svelte's "union too complex" on rest + overrides).
 */
/**
 * A component icon (Lucide) spreads its props on its `<svg>`, so an attachment
 * in them binds `ref` to that element.
 */
const refKey = createAttachmentKey();
function bindGlyph(node: Element): () => void {
  ref = node as SVGSVGElement;
  return () => {
    if (ref === node) ref = null;
  };
}

const glyphProps = $derived({
  ...rest,
  [refKey]: bindGlyph,
  class: classes,
  size: pixelSize,
  strokeWidth: strokeAttr,
  'data-tx-icon-stroke': strokeMark,
  ...(glyphColor !== undefined ? { color: glyphColor } : {}),
  focusable: 'false' as const,
  'aria-hidden': accessibleName ? undefined : ('true' as const),
  role: accessibleName ? ('img' as const) : undefined,
  'aria-label': accessibleName,
  'data-tx-icon': 'custom' as const,
} satisfies IconComponentProps & {
  class?: ClassValue;
  'data-tx-icon'?: string;
  'data-tx-icon-stroke'?: string;
});
</script>

{#if path}
  <svg bind:this={ref}
    {...rest}
    class={classes}
    width={pixelSize}
    height={pixelSize}
    viewBox="0 0 24 24"
    fill="none"
    stroke={glyphColor ?? 'currentColor'}
    stroke-width={strokeAttr}
    data-tx-icon-stroke={strokeMark}
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false"
    aria-hidden={accessibleName ? undefined : 'true'}
    role={accessibleName ? 'img' : undefined}
    aria-label={accessibleName}
    data-tx-icon={name}
  >
    <path d={path} />
  </svg>
{:else if component}
  {@const Glyph = component}
  <Glyph {...glyphProps} />
{/if}
