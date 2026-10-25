<script lang="ts">
import { Slider } from 'texuli/slider';

let volume = $state(35);
let price = $state([150, 750]);
let quality = $state(50);
let vertical = $state(40);
</script>

<div class="demo" data-example="texuli-slider">
  <section>
    <h2>Default</h2>
    <Slider bind:value={volume} label="Volume" showValue step={5} thumbLabel="Volume" />
  </section>

  <section>
    <h2>Sizes</h2>
    <Slider value={20} size="sm" label="Small" showValue thumbLabel="Small" />
    <Slider value={50} size="md" label="Medium" showValue thumbLabel="Medium" />
    <Slider value={80} size="lg" label="Large" showValue thumbLabel="Large" />
  </section>

  <section>
    <h2>Range</h2>
    <Slider
      type="multiple"
      bind:value={price}
      min={0}
      max={1000}
      step={10}
      label="Price range"
      showValue
      thumbLabel={['Minimum price', 'Maximum price']}
    />
  </section>

  <section>
    <h2>Marks and ticks</h2>
    <Slider
      bind:value={quality}
      min={0}
      max={100}
      step={25}
      label="Quality"
      showValue
      showTicks
      marks={[
        { value: 0, label: 'Draft' },
        { value: 50, label: 'Good' },
        { value: 100, label: 'Best' },
      ]}
      thumbLabel="Quality"
    />
  </section>

  <section>
    <h2>Vertical</h2>
    <Slider
      bind:value={vertical}
      orientation="vertical"
      label="Level"
      showValue
      thumbLabel="Level"
    />
  </section>

  <section>
    <h2>Disabled</h2>
    <Slider value={55} disabled label="Locked gain" showValue thumbLabel="Locked gain" />
  </section>

  <section dir="rtl" lang="ar">
    <h2>RTL</h2>
    <Slider value={60} dir="rtl" label="التوازن" showValue thumbLabel="التوازن" />
  </section>
</div>

<style>
  .demo {
    min-inline-size: 0;
    max-inline-size: min(100%, 40rem);
    display: grid;
    gap: 1.5rem;
    padding: 1rem;
    font-family: var(--tx-font-sans, system-ui, sans-serif);
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  section {
    display: grid;
    gap: 0.75rem;
  }
  h2 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
  }
</style>
