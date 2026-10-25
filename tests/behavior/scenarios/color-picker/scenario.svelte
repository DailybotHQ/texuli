<script lang="ts">
import { ColorPicker } from '@texuli/primitives/color-picker';
</script>

<h1 class="visually-hidden">Color picker interaction test</h1>
<ColorPicker.Root label="Brand color">
  <ColorPicker.Area id="color-area" aria-describedby="color-help" />
  <p id="color-help">Choose lightness and chroma.</p>
  <ColorPicker.Hue />
  <ColorPicker.Alpha />
  <ColorPicker.FormatInput />
  <ColorPicker.Swatch value="#ff0000" label="Red" />
  <ColorPicker.Swatch value="#0000ff" label="Blue" />
</ColorPicker.Root>

<style>
  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  :global(#color-area) {
    inline-size: 240px;
    block-size: 120px;
    border: 1px solid currentColor;
  }
</style>
