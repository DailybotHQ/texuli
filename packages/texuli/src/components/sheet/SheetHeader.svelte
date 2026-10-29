<script lang="ts">
import { Sheet as Primitive } from '@texuli/primitives/sheet';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import SheetCloseButton from './SheetCloseButton.svelte';
import { sheetDescriptionClass, sheetHeaderClass, sheetTitleClass } from './variants.ts';
import './sheet.css';

/**
 * A sheet header: the title (the sheet's accessible name), an optional
 * description, extra heading content, and the close control.
 */
type OwnProps = {
  /** Renders `Title` (it names the sheet). Omit it and render your own `Title` in `children`. */
  title?: string;
  /** Renders `Description` (it describes the sheet). */
  description?: string;
  children?: Snippet;
  /** Accessible name of the close control. Default "Close". */
  closeLabel?: string;
  hideClose?: boolean;
  class?: ClassValue;
};
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps>;

let {
  title,
  description,
  children,
  closeLabel: closeLabelProp,
  hideClose = false,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props & RefProp = $props();
const msg = useMessages();
const closeLabel = $derived(closeLabelProp ?? msg('texuli.sheet-header.close-label', 'Close'));
</script>

<div bind:this={ref} {...rest} class={sheetHeaderClass({ class: className })} data-tx-sheet-header="">
  <div class="tx-sheet__heading">
    {#if title}
      <Primitive.Title class={sheetTitleClass()}>{title}</Primitive.Title>
    {/if}
    {#if description}
      <Primitive.Description class={sheetDescriptionClass()}>{description}</Primitive.Description>
    {/if}
    {@render children?.()}
  </div>
  {#if !hideClose}
    <SheetCloseButton label={closeLabel} />
  {/if}
</div>
