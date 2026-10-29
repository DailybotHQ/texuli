<script lang="ts">
import { Sheet as Primitive } from '@texuli/primitives/sheet';
import type { ComponentProps } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { Icon } from '../icons/index.ts';
import { sheetCloseClass } from './variants.ts';
import './sheet.css';

/** The icon close control of a sheet header; its name is `label`. */
type Props = Omit<ComponentProps<typeof Primitive.Close>, 'children' | 'child'> & {
  /** Accessible name. Default "Close". */
  label?: string;
  class?: ClassValue;
};
let { label = 'Close', class: className, ref = $bindable(null), ...rest }: Props = $props();
</script>

<Primitive.Close bind:ref {...rest} class={sheetCloseClass({ class: className })} data-tx-sheet-close="">
  <Icon icon="close" size="sm" aria-hidden="true" />
  <span class="tx-sheet__close-label">{label}</span>
</Primitive.Close>
