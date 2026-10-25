<script lang="ts">
import { ColorPicker } from '../../../src/color-picker/index.ts';
</script>

<label for="brand-hue">Brand hue</label>
<label for="brand-hex">Brand hex</label>
<ColorPicker.Root id="brand-picker" label="Brand color">
  <ColorPicker.Hue id="brand-hue" />
  <ColorPicker.FormatInput id="brand-hex" />
</ColorPicker.Root>
