<script lang="ts">
import { Accordion, Collapsible, Tabs } from 'texuli/tabs-accordion';

let tab = $state('overview');
let faq = $state('ship');
</script>

<section data-example="texuli-tabs-accordion" aria-labelledby="tabs-acc-title">
  <h2 id="tabs-acc-title">Tabs, Accordion and Collapsible</h2>

  <h3>Tabs (line)</h3>
  <Tabs
    bind:value={tab}
    label="Product sections"
    variant="line"
    items={[
      { value: 'overview', label: 'Overview' },
      { value: 'pricing', label: 'Pricing', badge: 2 },
      { value: 'docs', label: 'Docs' },
      { value: 'legacy', label: 'Legacy', disabled: true },
    ]}
  >
    {#snippet content(item)}
      <p class="panel">Harbor Notes {item.label.toLowerCase()} (fictional).</p>
    {/snippet}
  </Tabs>

  <h3>Tabs (pills + enclosed, RTL)</h3>
  <div class="row" dir="rtl">
    <Tabs
      value="a"
      label="Pills"
      variant="pills"
      items={[
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ]}
    >
      {#snippet content(item)}
        <p class="panel">Pills: {item.label}</p>
      {/snippet}
    </Tabs>
    <Tabs
      value="x"
      label="Enclosed"
      variant="enclosed"
      items={[
        { value: 'x', label: 'One' },
        { value: 'y', label: 'Two' },
      ]}
    >
      {#snippet content(item)}
        <p class="panel">Enclosed: {item.label}</p>
      {/snippet}
    </Tabs>
  </div>

  <h3>Accordion</h3>
  <Accordion
    bind:value={faq}
    type="single"
    variant="bordered"
    items={[
      {
        value: 'ship',
        title: 'Shipping',
        content: 'Orders ship within two fictional days across the example region.',
      },
      {
        value: 'return',
        title: 'Returns',
        content: 'Return within 30 fictional days with the packing slip.',
      },
      {
        value: 'support',
        title: 'Support',
        content: 'Write to support@example.com (fictional inbox).',
        disabled: true,
      },
    ]}
  />

  <h3>Collapsible</h3>
  <Collapsible label="Advanced settings">
    <p class="panel">
      Density and motion preferences for Harbor Notes previews. Simulated only.
    </p>
  </Collapsible>
</section>

<style>
  h3 {
    margin-block: 1.5rem 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tx-muted-foreground, #575757);
  }
  .row {
    display: grid;
    gap: 1.25rem;
    max-inline-size: 40rem;
  }
  .panel {
    margin: 0.5rem 0 0;
    font-size: 0.9375rem;
    color: var(--tx-muted-foreground, #575757);
  }
</style>
