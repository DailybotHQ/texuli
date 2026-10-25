<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type AspectRatioValue, aspectRatioClass } from './variants.ts';
import './separator-aspect.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /**
   * Named ratio class. Ignored when `custom` is set.
   * Default `16/9`.
   */
  ratio?: AspectRatioValue;
  /**
   * Free-form CSS aspect-ratio value (e.g. `"5 / 4"` or `"1.618"`).
   * Applied as `--tx-aspect-ratio` — never a static `style=` string in markup.
   */
  custom?: string;
  children?: Snippet;
  class?: ClassValue;
};

let { ratio = '16/9', custom, children, class: className, ...rest }: Props = $props();

const isCustom = $derived(typeof custom === 'string' && custom.trim().length > 0);

const classes = $derived(
  isCustom
    ? cx('tx-aspect-ratio', 'tx-aspect-ratio--custom', className)
    : aspectRatioClass({
        ratio,
        class: className,
      })
);

const customStyle = $derived(isCustom ? `--tx-aspect-ratio: ${custom}` : undefined);
</script>

<div
  class={classes}
  data-tx-aspect-ratio
  data-ratio={isCustom ? 'custom' : ratio}
  style={customStyle}
  {...rest}
>
  <div class="tx-aspect-ratio__content">
    {@render children?.()}
  </div>
</div>
