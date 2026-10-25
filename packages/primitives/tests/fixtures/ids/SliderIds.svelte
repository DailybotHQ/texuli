<script lang="ts">
import { Slider } from '../../../src/slider/index.ts';
</script>

<span id="volume-label">Volume</span>
<Slider.Root id="volume-root" type="single" value={40}>
  <Slider.Range />
  <Slider.Thumb id="volume-thumb" aria-labelledby="volume-label" />
</Slider.Root>
