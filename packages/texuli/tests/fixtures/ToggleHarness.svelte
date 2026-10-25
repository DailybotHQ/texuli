<script lang="ts">
import {
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  type ToggleSize,
  type ToggleVariant,
} from '../../src/components/toggle/index.ts';

type Props = {
  mode?: 'single' | 'group-single' | 'group-multiple';
  label?: string;
  variant?: ToggleVariant;
  size?: ToggleSize;
  disabled?: boolean;
  pressed?: boolean;
  wrap?: boolean;
  onPressedChange?: (pressed: boolean) => void;
};

let {
  mode = 'single',
  label = 'Toggle',
  variant = 'default',
  size = 'md',
  disabled = false,
  pressed = $bindable(false),
  wrap = false,
  onPressedChange,
}: Props = $props();
</script>

{#if mode === 'single'}
  <Toggle bind:pressed {variant} {size} {disabled} {onPressedChange} aria-label={label}>
    {label}
  </Toggle>
{:else if mode === 'group-single'}
  <ToggleGroup type="single" variant="outline" size="sm" {wrap} aria-label="Align">
    <ToggleGroupItem value="left" aria-label="Left">Left</ToggleGroupItem>
    <ToggleGroupItem value="center" aria-label="Center">Center</ToggleGroupItem>
    <ToggleGroupItem value="right" aria-label="Right">Right</ToggleGroupItem>
  </ToggleGroup>
{:else}
  <ToggleGroup type="multiple" variant="default" aria-label="Format">
    <ToggleGroupItem value="bold" aria-label="Bold">Bold</ToggleGroupItem>
    <ToggleGroupItem value="italic" aria-label="Italic">Italic</ToggleGroupItem>
  </ToggleGroup>
{/if}
