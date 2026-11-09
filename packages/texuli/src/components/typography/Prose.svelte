<script lang="ts">
/**
 * Prose (ADR-032): long-form text (articles, docs, descriptions) with the design system's
 * reading rhythm: body type, a 65ch measure, spacing between blocks from the space scale,
 * heading, list, quote and code styles from the type roles. The content is the host's
 * markup (children); Prose never renders HTML from a string.
 */
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import {
  oneOf,
  PROSE_ELEMENTS,
  PROSE_SIZES,
  type ProseElement,
  type ProseSize,
  proseClass,
} from './variants.ts';

type Props = HTMLAttributes<HTMLElement> & {
  /** `div` (default), `article` or `section`. */
  as?: ProseElement;
  /** `md` (default) or `lg`. */
  size?: ProseSize;
  /** The rendered element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  as: asProp = 'div',
  size: sizeProp = 'md',
  class: className,
  children,
  ...rest
}: Props = $props();

const as = $derived(oneOf(PROSE_ELEMENTS, asProp, 'div'));
const size = $derived(oneOf(PROSE_SIZES, sizeProp, 'md'));
</script>

<svelte:element
  this={as}
  bind:this={ref}
  {...rest}
  class={cx(proseClass({ size }), className)}
  data-tx-component="prose"
  data-tx-size={size}
>{@render children?.()}</svelte:element>
