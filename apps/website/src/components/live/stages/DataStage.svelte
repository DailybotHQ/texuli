<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Card, Kpi, Stat, Stepper and Timeline with fictional data: the
 * panel-driven instance, then the other variants and states.
 */
import { Button } from 'texuli/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from 'texuli/card';
import { Kpi, KpiRow, Stat } from 'texuli/stat';
import { Stepper, type StepperStep } from 'texuli/stepper';
import { Timeline, type TimelineItemData } from 'texuli/timeline';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, num, bool, pick } = readers(() => values);

const STEPS: StepperStep[] = [
  { id: 'cart', label: 'Cart', description: 'Three items' },
  { id: 'ship', label: 'Shipping', description: 'Address and speed' },
  { id: 'pay', label: 'Payment', description: 'Card or invoice' },
  { id: 'done', label: 'Review' },
];

const ITEMS: TimelineItemData[] = [
  {
    id: 'packed',
    time: 'Mon',
    title: 'Packed',
    description: 'Two boxes sealed.',
    status: 'complete',
    tone: 'success',
  },
  {
    id: 'transit',
    time: 'Tue',
    title: 'In transit',
    description: 'Left the Harbor depot.',
    status: 'current',
  },
  { id: 'delivered', time: 'Thu', title: 'Delivered', status: 'upcoming', tone: 'info' },
];

let current = $state(1);
$effect(() => {
  current = Math.min(STEPS.length - 1, Math.max(0, Math.round(num('current', 1))));
});
</script>

<div class="stage" data-tx-data-stage={componentId}>
  {#if componentId === 'card'}
    <div class="grid">
      {#each [pick('variant', ['elevated', 'flat'] as const, 'elevated'), 'flat' as const] as variant, index (index)}
        <Card {variant}>
          <CardHeader>
            <CardTitle level={3}>{index === 0 ? 'Harbor Notes' : 'Flat card'}</CardTitle>
            <CardDescription>{variant} surface</CardDescription>
          </CardHeader>
          <CardContent>Twelve drafts are waiting for review.</CardContent>
          <CardFooter>
            <Button size="sm" variant="outline">Open drafts</Button>
          </CardFooter>
        </Card>
      {/each}
    </div>
  {:else if componentId === 'kpi'}
    <KpiRow label="Order metrics" minItemWidth="11rem">
      <Kpi
        label={str('label', 'Orders')}
        value={num('value', 1280)}
        unit={pick('unit', ['number', 'compact', 'cents', 'percent'] as const, 'compact')}
        previous={num('previous', 1100)}
        comparisonLabel={str('comparisonLabel', 'vs last week')}
        positive={pick('positive', ['up', 'down'] as const, 'up')}
        loading={bool('loading')}
        variant={pick('variant', ['elevated', 'flat'] as const, 'elevated')}
      />
      <Kpi label="Churn" value={0.031} previous={0.04} unit="percent" positive="down" variant="flat" />
      <Kpi label="Loading" value={0} loading />
    </KpiRow>
  {:else if componentId === 'stat'}
    <KpiRow label="Store stats" minItemWidth="11rem">
      <Stat
        label={str('label', 'Revenue')}
        value="$12.4k"
        delta="+8%"
        trend={pick('trend', ['up', 'down', 'neutral'] as const, 'up')}
        positive={pick('positive', ['up', 'down'] as const, 'up')}
        hint={str('hint', 'vs last month')}
        variant={pick('variant', ['elevated', 'flat'] as const, 'elevated')}
      />
      <Stat label="Latency" value="84 ms" delta="-6 ms" trend="down" positive="down" variant="flat" />
    </KpiRow>
  {:else if componentId === 'stepper'}
    <Stepper
      steps={STEPS}
      {current}
      orientation={pick('orientation', ['horizontal', 'vertical'] as const, 'horizontal')}
      label={str('label', 'Checkout progress')}
    />
    <p class="row">
      <Button size="sm" variant="outline" disabled={current === 0} onclick={() => (current -= 1)}>
        Back
      </Button>
      <Button size="sm" disabled={current === STEPS.length - 1} onclick={() => (current += 1)}>
        Next step
      </Button>
    </p>
  {:else}
    <Timeline
      items={ITEMS}
      orientation={pick('orientation', ['vertical', 'horizontal'] as const, 'vertical')}
      label={str('label', 'Shipment history')}
    />
  {/if}
</div>

<style>
  .stage {
    display: grid;
    gap: 0.75rem;
  }
  .grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
  }
</style>
