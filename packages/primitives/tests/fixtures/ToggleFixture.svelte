<script lang="ts">
import { Toggle } from '../../src/toggle/index.ts';

let {
  label = 'Toggle',
  pressed,
  onPressedChange,
  disabled = false,
}: {
  label?: string;
  pressed?: boolean;
  onPressedChange?: (value: boolean) => void;
  disabled?: boolean;
} = $props();
</script>

{#if pressed === undefined}
  <Toggle.Root {disabled} {onPressedChange} aria-label={label}>{label}</Toggle.Root>
{:else}
  <Toggle.Root {pressed} {disabled} {onPressedChange} aria-label={label}>{label}</Toggle.Root>
{/if}
