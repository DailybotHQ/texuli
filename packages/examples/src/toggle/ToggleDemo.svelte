<script lang="ts">
import { Toggle, ToggleGroup, ToggleGroupItem } from 'texuli/toggle';

let bold = $state(false);
let align = $state('left');
let format = $state<string[]>(['bold']);
</script>

<div class="demo" data-example="texuli-toggle">
  <section>
    <h2>Default toggle</h2>
    <Toggle bind:pressed={bold}>Bold</Toggle>
  </section>

  <section>
    <h2>Variants and sizes</h2>
    <div class="row">
      <Toggle variant="default" size="sm">Sm</Toggle>
      <Toggle variant="default" size="md" defaultPressed>Md</Toggle>
      <Toggle variant="default" size="lg">Lg</Toggle>
      <Toggle variant="outline">Outline</Toggle>
      <Toggle variant="outline" disabled>Off</Toggle>
    </div>
  </section>

  <section>
    <h2>Single group (segmented)</h2>
    <ToggleGroup type="single" bind:value={align} variant="outline" aria-label="Text align">
      <ToggleGroupItem value="left">Left</ToggleGroupItem>
      <ToggleGroupItem value="center">Center</ToggleGroupItem>
      <ToggleGroupItem value="right">Right</ToggleGroupItem>
    </ToggleGroup>
    <p class="hint">Selected: {align || 'none'}</p>
  </section>

  <section>
    <h2>Multiple group</h2>
    <ToggleGroup type="multiple" bind:value={format} aria-label="Text style">
      <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
      <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
      <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
    </ToggleGroup>
  </section>

  <section>
    <h2>Vertical outline</h2>
    <ToggleGroup
      type="single"
      orientation="vertical"
      variant="outline"
      defaultValue="day"
      aria-label="View"
    >
      <ToggleGroupItem value="day">Day</ToggleGroupItem>
      <ToggleGroupItem value="week">Week</ToggleGroupItem>
      <ToggleGroupItem value="month">Month</ToggleGroupItem>
    </ToggleGroup>
  </section>

  <section dir="rtl" lang="ar">
    <h2>RTL</h2>
    <ToggleGroup type="single" variant="outline" defaultValue="a" aria-label="اتجاه">
      <ToggleGroupItem value="a">أ</ToggleGroupItem>
      <ToggleGroupItem value="b">ب</ToggleGroupItem>
      <ToggleGroupItem value="c">ج</ToggleGroupItem>
    </ToggleGroup>
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
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--tx-muted-foreground, GrayText);
  }
</style>
