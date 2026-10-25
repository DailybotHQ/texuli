<script lang="ts">
import { PinInput, REGEXP_ONLY_DIGITS } from '../src/pin-input/index.ts';

interface Props {
  value?: string;
  mask?: boolean;
  disabled?: boolean;
  pattern?: string | undefined;
  pasteTransformer?: (text: string) => string;
  onComplete?: (value: string) => void;
  onValueChange?: (value: string) => void;
}

let {
  value = $bindable(''),
  mask = false,
  disabled = false,
  pattern = REGEXP_ONLY_DIGITS,
  pasteTransformer,
  onComplete,
  onValueChange,
}: Props = $props();
</script>

<PinInput.Root
  bind:value
  maxlength={6}
  {pattern}
  {mask}
  {disabled}
  {pasteTransformer}
  {onComplete}
  {onValueChange}
  aria-label="Verification code"
  name="code"
>
  {#snippet children({ cells })}
    {#each cells as cell, index (index)}
      {#if index === 5}
        <PinInput.Cell {cell}>
          {#snippet child({ props })}<span {...props} data-testid="last-cell">{cell.char ?? ''}</span>{/snippet}
        </PinInput.Cell>
      {:else}
        <PinInput.Cell {cell} data-testid={`cell-${index}`} />
      {/if}
    {/each}
  {/snippet}
</PinInput.Root>
<output data-testid="value">{value}</output>
