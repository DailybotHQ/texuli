<script lang="ts">
import { ColorPicker } from '../../src/color-picker/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<ColorPicker.Root value="#3366ff" {...p('color-picker/Root')} bind:ref={refs['color-picker/Root']}>
  <ColorPicker.Area {...p('color-picker/Area')} bind:ref={refs['color-picker/Area']} />
  <ColorPicker.Hue {...p('color-picker/Hue')} bind:ref={refs['color-picker/Hue']} />
  <ColorPicker.Alpha {...p('color-picker/Alpha')} bind:ref={refs['color-picker/Alpha']} />
  <ColorPicker.FormatInput {...p('color-picker/FormatInput')} bind:ref={refs['color-picker/FormatInput']} />
  <ColorPicker.Swatch value="#ff0000" label="Red" {...p('color-picker/Swatch')} bind:ref={refs['color-picker/Swatch']} />
</ColorPicker.Root>
