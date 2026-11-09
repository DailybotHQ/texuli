<script lang="ts">
/**
 * Heading (ADR-032): a section or page title. `level` picks the semantic `<h1>`…`<h6>`;
 * `size` picks the visual size from the design system's type scale, independent of the
 * level, so the document outline and the visual hierarchy never fight. Tones and sizes are
 * `--tx-*` tokens only; a locked prototype keeps its hierarchy without typography utilities.
 */
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import {
  HEADING_LEVELS,
  HEADING_SIZES,
  HEADING_TONES,
  type HeadingLevel,
  type HeadingSize,
  type HeadingTone,
  headingClass,
  headingSizeOf,
  oneOf,
} from './variants.ts';

type Props = HTMLAttributes<HTMLHeadingElement> & {
  /** The semantic level: renders `<h1>`…`<h6>`. Default 2. */
  level?: HeadingLevel;
  /** The visual size (`display`, `xl`, `lg`, `md`, `sm`). Default: from the level (1 xl, 2 lg, 3 md, 4–6 sm). */
  size?: HeadingSize;
  /** `default` or `muted`. Default `default`. */
  tone?: HeadingTone;
  /** One line with an ellipsis; the full text stays in the accessibility tree. */
  truncate?: boolean;
  /** Plain-text heading, rendered as escaped text; replaces `children` when non-empty. */
  label?: string;
  /** The rendered element (bindable). */
  ref?: HTMLHeadingElement | null;
};

let {
  ref = $bindable(null),
  level: levelProp = 2,
  size: sizeProp,
  tone: toneProp = 'default',
  truncate = false,
  label,
  class: className,
  children,
  ...rest
}: Props = $props();

const level = $derived(oneOf(HEADING_LEVELS, levelProp, 2));
const size = $derived(oneOf(HEADING_SIZES, sizeProp, headingSizeOf(level)));
const tone = $derived(oneOf(HEADING_TONES, toneProp, 'default'));
const hasLabel = $derived(typeof label === 'string' && label.length > 0);
</script>

<svelte:element
  this={`h${level}`}
  bind:this={ref}
  {...rest}
  class={cx(headingClass({ size, tone }), truncate && 'tx-type--truncate', className)}
  data-tx-component="heading"
  data-tx-size={size}
  data-tx-tone={tone}
>{#if hasLabel}{label}{:else}{@render children?.()}{/if}</svelte:element>
