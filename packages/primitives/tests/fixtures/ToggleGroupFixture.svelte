<script lang="ts">
import { untrack } from 'svelte';
import { ToggleGroup } from '../../src/toggle/index.ts';
import type { ToggleGroupType } from '../../src/toggle/types.ts';

let {
  type = 'single' as ToggleGroupType,
  onValueChange,
  label = 'Group',
  rovingFocus = true,
  disableRight = false,
  value,
}: {
  type?: ToggleGroupType;
  onValueChange?: (value: string | string[]) => void;
  label?: string;
  rovingFocus?: boolean;
  disableRight?: boolean;
  value?: string | string[];
} = $props();

const items = untrack(() =>
  type === 'multiple'
    ? [
        { value: 'bold', label: 'Bold' },
        { value: 'italic', label: 'Italic' },
      ]
    : [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ]
);
</script>

{#if value === undefined}
  <ToggleGroup.Root {type} {onValueChange} {rovingFocus} aria-label={label}>
    {#each items as item (item.value)}
      <ToggleGroup.Item
        value={item.value}
        disabled={disableRight && item.value === 'right'}
        aria-label={item.label}
      >
        {item.label}
      </ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
{:else}
  <ToggleGroup.Root {type} {value} {onValueChange} {rovingFocus} aria-label={label}>
    {#each items as item (item.value)}
      <ToggleGroup.Item
        value={item.value}
        disabled={disableRight && item.value === 'right'}
        aria-label={item.label}
      >
        {item.label}
      </ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
{/if}
