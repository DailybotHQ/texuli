<script lang="ts">
import { Splitter } from '@texuli/primitives/splitter';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type ResizableHandleSize, resizableHandleClass } from './variants.ts';

/**
 * The handle between two panels: a focusable `role="separator"` named by
 * `label` (translate it, and name the panel it resizes, for example
 * "Resize navigation"). Arrow keys, Home, End and Enter resize; pointer and
 * touch drag it.
 */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class' | 'role'> & {
  /** Accessible name. Default "Resize". */
  label?: string;
  disabled?: boolean;
  /** Show a grip pill on the divider. Default `true`. */
  withGrip?: boolean;
  /** Grip size. Default `md`. */
  size?: ResizableHandleSize;
  class?: ClassValue;
  ref?: HTMLElement | null;
};

let {
  label: labelProp,
  disabled = false,
  withGrip = true,
  size = 'md',
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const label = $derived(labelProp ?? msg('texuli.resizable-handle.label', 'Resize'));

const handleClass = $derived(resizableHandleClass({ size, class: className }));
</script>

<Splitter.Handle {...rest} {label} {disabled} bind:ref>
  {#snippet child({ props })}
    <div {...props} class={cx(handleClass, props.class as string | undefined)} data-tx-resizable-handle="">
      {#if withGrip}<span class="tx-resizable__grip" aria-hidden="true"></span>{/if}
    </div>
  {/snippet}
</Splitter.Handle>
