<script lang="ts">
import { type ColorFormat, ColorPicker } from '@texuli/primitives/color-picker';

let {
  disabled = false,
  format,
  useChild = false,
}: { disabled?: boolean; format?: ColorFormat; useChild?: boolean } = $props();
</script>

{#snippet controls()}
  <ColorPicker.Area />
  <ColorPicker.Hue />
  <ColorPicker.Alpha />
  <ColorPicker.FormatInput />
  <ColorPicker.Swatch value="#ff0000" label="Red" />
  <ColorPicker.Swatch value="#00ff00" label="Green" />
{/snippet}

{#snippet composed({ props }: { props: Record<string, unknown> })}
  <section {...props} data-testid="custom-color-picker">{@render controls()}</section>
{/snippet}

{#if useChild}
  <ColorPicker.Root label="Brand color" {disabled} {format} child={composed} />
{:else}
  <ColorPicker.Root label="Brand color" {disabled} {format}>{@render controls()}</ColorPicker.Root>
{/if}
