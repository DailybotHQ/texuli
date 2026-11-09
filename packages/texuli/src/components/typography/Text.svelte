<script lang="ts">
/**
 * Text (ADR-032): body copy, labels, captions and small print. `as` is a closed list of
 * text elements and never a heading (use Heading for titles). Size, tone and weight come
 * from the design system's type scale and role inks (`--tx-*`); `truncate` keeps one line,
 * `lineClamp` keeps 1 to 10 lines. `size="figure"` with `tabular` sets a large number outside
 * Stat; `size="xs" tone="muted" transform="uppercase" tracking="wide"` is an eyebrow (overline).
 */
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import {
  oneOf,
  TEXT_ALIGNS,
  TEXT_ELEMENTS,
  TEXT_SIZES,
  TEXT_TONES,
  TEXT_TRACKINGS,
  TEXT_TRANSFORMS,
  TEXT_WEIGHTS,
  type TextAlign,
  type TextElement,
  type TextSize,
  type TextTone,
  type TextTracking,
  type TextTransform,
  type TextWeight,
  textClass,
} from './variants.ts';

type Props = HTMLAttributes<HTMLElement> & {
  /** The element: `p` (default), `span`, `div`, `label`, `small` or `strong`. Never a heading. */
  as?: TextElement;
  /** `figure` (a large number), `lg`, `md` (default), `sm` or `xs`. */
  size?: TextSize;
  /** The ink: `default`, `muted`, `subtle`, `primary`, `success`, `warning`, `destructive`, `info`. */
  tone?: TextTone;
  /** `regular` (default), `medium` or `semibold`. */
  weight?: TextWeight;
  /** One line with an ellipsis. */
  truncate?: boolean;
  /** Clamp to this many lines (1 to 10) with an ellipsis. */
  lineClamp?: number;
  /** `start` (default), `center` or `end` (logical, right-to-left aware). */
  align?: TextAlign;
  /** The design system's code family. */
  mono?: boolean;
  /** Tabular figures (`font-variant-numeric: tabular-nums`) for numbers that line up. */
  tabular?: boolean;
  /** `none` (default), `uppercase`, `lowercase` or `capitalize`. */
  transform?: TextTransform;
  /** Letter spacing: `normal` (default) or `wide` (the `--tx-letter-spacing-wide` token). */
  tracking?: TextTracking;
  /** With `as="label"`: the id of the control it labels. */
  for?: string;
  /** Plain text, rendered as escaped text; replaces `children` when non-empty. */
  label?: string;
  /** The rendered element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  as: asProp = 'p',
  size: sizeProp = 'md',
  tone: toneProp = 'default',
  weight: weightProp = 'regular',
  truncate = false,
  lineClamp,
  align: alignProp = 'start',
  mono = false,
  tabular = false,
  transform: transformProp = 'none',
  tracking: trackingProp = 'normal',
  for: htmlFor,
  label,
  class: className,
  children,
  ...rest
}: Props = $props();

const as = $derived(oneOf(TEXT_ELEMENTS, asProp, 'p'));
const size = $derived(oneOf(TEXT_SIZES, sizeProp, 'md'));
const tone = $derived(oneOf(TEXT_TONES, toneProp, 'default'));
const weight = $derived(oneOf(TEXT_WEIGHTS, weightProp, 'regular'));
const align = $derived(oneOf(TEXT_ALIGNS, alignProp, 'start'));
const transform = $derived(oneOf(TEXT_TRANSFORMS, transformProp, 'none'));
const tracking = $derived(oneOf(TEXT_TRACKINGS, trackingProp, 'normal'));
const lines = $derived(
  typeof lineClamp === 'number' && Number.isInteger(lineClamp) && lineClamp >= 1 && lineClamp <= 10
    ? lineClamp
    : undefined
);
const hasLabel = $derived(typeof label === 'string' && label.length > 0);
</script>

<svelte:element
  this={as}
  bind:this={ref}
  {...rest}
  for={as === 'label' ? htmlFor : undefined}
  class={cx(
    textClass({ size, tone, weight, align, transform, tracking }),
    mono && 'tx-text--mono',
    tabular && 'tx-text--tabular',
    truncate && !lines && 'tx-type--truncate',
    lines && 'tx-type--clamp',
    className
  )}
  style:--tx-text-line-clamp={lines}
  data-tx-component="text"
  data-tx-size={size}
  data-tx-tone={tone}
>{#if hasLabel}{label}{:else}{@render children?.()}{/if}</svelte:element>
