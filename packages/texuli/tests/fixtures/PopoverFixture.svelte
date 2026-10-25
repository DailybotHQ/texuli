<script lang="ts">
import {
  Popover,
  type PopoverSize,
  type PopoverVariant,
} from '../../src/components/popover/index.ts';

let {
  open = $bindable(false),
  label = 'Popover',
  variant = 'elevated' as PopoverVariant,
  size = 'md' as PopoverSize,
  focusDone = false,
}: {
  open?: boolean;
  label?: string;
  variant?: PopoverVariant;
  size?: PopoverSize;
  /** Focus the Done control on open (initialFocus). */
  focusDone?: boolean;
} = $props();
let done = $state<HTMLElement>();
const initialFocus = $derived(
  focusDone ? () => done?.querySelector<HTMLElement>('button') ?? null : undefined
);
</script>

<Popover.Root bind:open side="bottom" align="center">
  <Popover.Trigger>Open menu</Popover.Trigger>
  <Popover.Content aria-label={label} {variant} {size} {initialFocus}>
    <div class="tx-popover__header">
      <p class="tx-popover__title">{label}</p>
      <p class="tx-popover__description">Signed in as ada@example.com</p>
      {#if focusDone}
        <!-- An earlier control, so the default (first control) would not be Done. -->
        <button type="button">Settings</button>
      {/if}
    </div>
    <div class="tx-popover__footer" bind:this={done}>
      <Popover.Close>Done</Popover.Close>
    </div>
  </Popover.Content>
</Popover.Root>
