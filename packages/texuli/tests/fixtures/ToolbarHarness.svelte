<script lang="ts">
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarGroupItem,
  ToolbarLink,
  ToolbarSeparator,
  type ToolbarVariant,
} from '../../src/components/toolbar/index.ts';

type Props = {
  mode?: 'default' | 'group' | 'vertical' | 'disabled-link';
  variant?: ToolbarVariant;
};

let { mode = 'default', variant = 'default' }: Props = $props();

let align = $state('left');
let format = $state<string[]>(['bold']);
</script>

{#if mode === 'default'}
  <Toolbar {variant} aria-label="Editor">
    <ToolbarButton aria-label="Undo">Undo</ToolbarButton>
    <ToolbarButton aria-label="Redo">Redo</ToolbarButton>
    <ToolbarSeparator />
    <ToolbarButton aria-label="Save" disabled>Save</ToolbarButton>
    <ToolbarLink href="https://example.com/help" aria-label="Help">Help</ToolbarLink>
  </Toolbar>
{:else if mode === 'group'}
  <Toolbar variant="outline" aria-label="Format">
    <ToolbarGroup type="single" bind:value={align} aria-label="Align">
      <ToolbarGroupItem value="left" aria-label="Left">Left</ToolbarGroupItem>
      <ToolbarGroupItem value="center" aria-label="Center">Center</ToolbarGroupItem>
      <ToolbarGroupItem value="right" aria-label="Right">Right</ToolbarGroupItem>
    </ToolbarGroup>
    <ToolbarSeparator />
    <ToolbarGroup type="multiple" bind:value={format} aria-label="Style">
      <ToolbarGroupItem value="bold" aria-label="Bold">Bold</ToolbarGroupItem>
      <ToolbarGroupItem value="italic" aria-label="Italic">Italic</ToolbarGroupItem>
    </ToolbarGroup>
  </Toolbar>
{:else if mode === 'vertical'}
  <Toolbar orientation="vertical" variant="outline" aria-label="Side tools">
    <ToolbarButton aria-label="Select">Select</ToolbarButton>
    <ToolbarButton aria-label="Pen">Pen</ToolbarButton>
    <ToolbarSeparator />
    <ToolbarButton aria-label="Eraser">Eraser</ToolbarButton>
  </Toolbar>
{:else}
  <Toolbar aria-label="Links">
    <ToolbarLink href="javascript:alert(1)" aria-label="Unsafe">Unsafe</ToolbarLink>
    <ToolbarLink href="https://example.com" aria-label="Safe">Safe</ToolbarLink>
  </Toolbar>
{/if}
