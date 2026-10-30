<script lang="ts">
import type { HTMLTableAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { setTableContext } from './context.ts';
import { fillStackLabels, isScrollable } from './labels.ts';
import { type TableDensity, type TableStack, type TableVariant, tableClass } from './variants.ts';
import './table.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = HTMLTableAttributes & {
  /** The `<table>` element (bindable). */
  ref?: HTMLElement | null;
  /** Row treatment. */
  variant?: TableVariant;
  /** Cell padding, scaled by the theme's `--tx-density`. */
  density?: TableDensity;
  /** Stack rows into labelled cards when the table's container is narrow. */
  stack?: TableStack;
  /** Keep the header row visible while the table's own area scrolls. */
  stickyHeader?: boolean;
  /**
   * Caps the table's height (a CSS length such as `20rem` or `60vh`) so its
   * body scrolls under the header. Anything that is not a plain length is ignored.
   */
  maxBlockSize?: string;
  /**
   * Names the scroll area when the table overflows. Without it, the caption
   * names it. Pass translated text.
   */
  label?: string;
  /** Marks the table as loading (`aria-busy`). */
  busy?: boolean;
  /** Classes for the scroll wrapper; `class` goes on the `<table>`. */
  wrapperClass?: string;
};

let {
  variant: variantProp,
  density = 'default',
  stack = 'never',
  stickyHeader = false,
  maxBlockSize,
  label,
  busy = false,
  wrapperClass,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('table');
const variant = $derived(withDefault(variantProp, txDefaults().variant, 'plain'));

function bindRef(node: HTMLTableElement): () => void {
  ref = node;
  return () => {
    if (ref === node) ref = null;
  };
}

let wrapper: HTMLDivElement | undefined = $state();
let table: HTMLTableElement | undefined = $state();
let scrollable = $state(false);
let captionId: string | undefined = $state();

// The context is read once per part; `stack` is fixed for a table's lifetime.
// svelte-ignore state_referenced_locally
const stacked = stack !== 'never';
setTableContext({
  stacked,
  setCaptionId(id) {
    captionId = id;
  },
});

// Only plain lengths, so a caller cannot inject other declarations.
const SAFE_LENGTH = /^\d*\.?\d+(?:px|rem|em|vh|dvh|svh|lvh|%)$/;
const height = $derived(
  maxBlockSize && SAFE_LENGTH.test(maxBlockSize.trim()) ? maxBlockSize.trim() : undefined
);
const named = $derived(Boolean(label) || Boolean(captionId));

// A table that overflows its area becomes a focusable, named region, so
// keyboard users can scroll it (WCAG 2.1.1).
$effect(() => {
  const area = wrapper;
  const inner = table;
  if (!area || !inner || typeof ResizeObserver === 'undefined') return;
  const measure = () => {
    scrollable = isScrollable(area);
  };
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(area);
  observer.observe(inner);
  return () => observer.disconnect();
});

// Stacked rows show each column's header before the value.
$effect(() => {
  const inner = table;
  if (!stacked || !inner) return;
  fillStackLabels(inner);
  if (typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(() => fillStackLabels(inner));
  observer.observe(inner, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
});
</script>

<!-- A scrollable area must take focus so keyboard users can scroll it (axe scrollable-region-focusable). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={wrapper}
  class={cx(
    'tx-table-wrap',
    stickyHeader && 'tx-table-wrap--sticky',
    height && 'tx-table-wrap--capped',
    wrapperClass
  )}
  style={height ? `max-block-size: ${height}` : undefined}
  role={scrollable && named ? 'region' : undefined}
  aria-label={scrollable && named ? label : undefined}
  aria-labelledby={scrollable && named && !label ? captionId : undefined}
  tabindex={scrollable ? 0 : undefined}
  data-tx-table-wrap
  data-scrollable={scrollable ? 'true' : undefined}
>
  <table
    bind:this={table}
    class={tableClass({
      variant,
      density,
      stack,
      class: className,
    })}
    role={stacked ? 'table' : undefined}
    aria-busy={busy || undefined}
    data-tx-table
    data-variant={variant}
    data-density={density}
    data-stack={stack}
    {...rest}
    {@attach bindRef}
  >
    {@render children?.()}
  </table>
</div>
