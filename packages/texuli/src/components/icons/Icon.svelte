<script lang="ts">
import { createAttachmentKey } from 'svelte/attachments';
import type { SVGAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { designDefaults } from '../../internal/design-defaults.ts';
import { ICON_SIZES, iconClass } from './icon-variants.ts';
import { iconPath, isIconName } from './icons.ts';
import { iconLookup } from './registry.ts';
import type { IconComponentProps, IconRef, IconSize, IconTone } from './types.ts';

type Props = Omit<SVGAttributes<SVGSVGElement>, 'class' | 'color'> & {
  /**
   * A built-in icon name, a name registered with `registerIcons` or
   * `IconsProvider`, or a Svelte SVG component (such as a Lucide icon).
   */
  icon?: IconRef;
  size?: IconSize;
  tone?: IconTone;
  /** Passed through to custom/Lucide components; Lucide accepts number | string. */
  strokeWidth?: number | string;
  /** Optional color; `null` is normalized away before spreading onto Lucide. */
  color?: string | null;
  class?: ClassValue;
  /** Adds an accessible image name; without it the icon is decorative. */
  label?: string;
};

const txDefaults = designDefaults('icon');
let {
  icon,
  size = txDefaults().size ?? 'md',
  tone = 'default',
  strokeWidth = 2,
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
const lookup = iconLookup();
/**
 * The glyph: a built-in path (built-in names keep their own glyphs), then a
 * registered component or path, or the component passed in. Unknown names
 * render nothing.
 */
const glyph = $derived(
  typeof icon === 'string' ? (isIconName(icon) ? iconPath(icon) : lookup(icon)) : icon
);
const name = $derived(typeof icon === 'string' && glyph !== undefined ? icon : undefined);
const component = $derived(typeof glyph === 'function' ? glyph : undefined);
const path = $derived(typeof glyph === 'string' ? glyph : undefined);
const accessibleName = $derived(label ?? ariaLabel);
const classes = $derived(iconClass({ size, tone, class: className }));
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
  strokeWidth,
  ...(glyphColor !== undefined ? { color: glyphColor } : {}),
  focusable: 'false' as const,
  'aria-hidden': accessibleName ? undefined : ('true' as const),
  role: accessibleName ? ('img' as const) : undefined,
  'aria-label': accessibleName,
  'data-tx-icon': name ?? 'custom',
  'data-tx-component': 'icon',
  'data-tx-size': size,
  'data-tx-tone': tone,
} satisfies IconComponentProps & {
  class?: ClassValue;
  'data-tx-icon'?: string;
  'data-tx-component'?: string;
  'data-tx-size'?: IconSize;
  'data-tx-tone'?: IconTone;
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
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false"
    aria-hidden={accessibleName ? undefined : 'true'}
    role={accessibleName ? 'img' : undefined}
    aria-label={accessibleName}
    data-tx-icon={name}
    data-tx-component="icon"
    data-tx-size={size}
    data-tx-tone={tone}
  >
    <path d={path} />
  </svg>
{:else if component}
  {@const Glyph = component}
  <Glyph {...glyphProps} />
{/if}
