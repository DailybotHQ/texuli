<script lang="ts">
import { Toggle, ToggleGroup } from '../../../../packages/primitives/src/toggle/index.ts';

let bold = $state(false);
let align = $state('');
let styles = $state<string[]>([]);
</script>

<section aria-label="Toggle behavior">
  <div>
    <Toggle.Root bind:pressed={bold} aria-label="Bold">Bold</Toggle.Root>
    <Toggle.Root disabled aria-label="Locked">Locked</Toggle.Root>
  </div>

  <ToggleGroup.Root type="single" bind:value={align} aria-label="Align">
    <ToggleGroup.Item value="left" aria-label="Left">Left</ToggleGroup.Item>
    <ToggleGroup.Item value="center" aria-label="Center">Center</ToggleGroup.Item>
    <ToggleGroup.Item value="right" aria-label="Right">Right</ToggleGroup.Item>
  </ToggleGroup.Root>

  <ToggleGroup.Root type="multiple" bind:value={styles} aria-label="Style">
    <ToggleGroup.Item value="italic" aria-label="Italic">Italic</ToggleGroup.Item>
    <ToggleGroup.Item value="underline" aria-label="Underline">Underline</ToggleGroup.Item>
  </ToggleGroup.Root>
</section>
