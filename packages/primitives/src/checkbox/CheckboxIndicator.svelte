<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Optional visual indicator. Hosts typically render check marks via the
 * Root `children` snippet; Indicator is available for composition APIs.
 */
type Props = HTMLAttributes<HTMLSpanElement> & {
  forceMount?: boolean;
  /** When true, the indicator is shown (host usually binds this to checked). */
  visible?: boolean;
  children?: Snippet;
};

let { forceMount = false, visible = true, children, class: className, ...rest }: Props = $props();
</script>

{#if forceMount || visible}
  <span
    class={className}
    data-tx-checkbox-indicator=""
    data-state={visible ? 'checked' : 'unchecked'}
    aria-hidden="true"
    {...rest}
  >
    {@render children?.()}
  </span>
{/if}
