<script lang="ts">
import { type CommandInputProps, Input as PrimitiveInput } from '@texuli/primitives/command';
import { type ClassValue } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import { commandInputClass, commandInputRowClass } from './variants.ts';
import './command.css';

/** The primitive input's props (native input attributes it does not own) plus row chrome. */
type Props = CommandInputProps & {
  /** Show the Esc kbd hint in the input row. Default true. */
  showEscHint?: boolean;
  /** Accessible label for the Esc hint. */
  escLabel?: string;
  class?: ClassValue;
  rowClass?: string;
};

let {
  value = $bindable(),
  onValueChange,
  showEscHint = true,
  escLabel = 'Esc',
  placeholder = 'Search commands…',
  class: className,
  rowClass,
  ref = $bindable(null),
  ...rest
}: Props & RefProp = $props();

const rowClasses = $derived(
  commandInputRowClass({
    class: typeof rowClass === 'string' ? rowClass : undefined,
  })
);
const inputClasses = $derived(
  commandInputClass({
    class: className,
  })
);
</script>

<div class={rowClasses} data-tx-command-input-row>
  <svg
    class="tx-command__search-icon"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
    <path
      d="m10.5 10.5 3 3"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
  </svg>
  <PrimitiveInput bind:ref
    class={inputClasses}
    data-tx-command-input
    bind:value
    {onValueChange}
    {placeholder}
    {...rest}
  />
  {#if showEscHint}
    <kbd class="tx-command__kbd" data-tx-command-esc>{escLabel}</kbd>
  {/if}
</div>
