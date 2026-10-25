<script lang="ts">
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardGrid,
  CardHeader,
  CardTitle,
} from 'texuli/card';

/**
 * Pricing: three plans with the middle one featured. Prices are integer
 * cents, formatted for display. Copy-ready: `texuli add badge button card`.
 */
const plans = [
  {
    id: 'deckhand',
    name: 'Deckhand',
    cents: 0,
    period: 'forever',
    blurb: 'One vessel, three crew.',
    features: ['Shift handovers', 'Incident log', '30 days of history'],
    featured: false,
  },
  {
    id: 'captain',
    name: 'Captain',
    cents: 1200,
    period: 'per month',
    blurb: 'For a working fleet.',
    features: ['Everything in Deckhand', 'Unlimited crew', 'Exports to PDF', 'One year of history'],
    featured: true,
  },
  {
    id: 'harbor',
    name: 'Harbor',
    cents: 4900,
    period: 'per month',
    blurb: 'For the whole port.',
    features: ['Everything in Captain', 'Harbor master access', 'Unlimited history'],
    featured: false,
  },
];

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
});
</script>

<section class="pricing" aria-labelledby="pricing-title">
  <h3 id="pricing-title" class="pricing__title">Simple plans for every crew</h3>
  <CardGrid minItemWidth="15rem">
    {#each plans as plan (plan.id)}
      <Card variant={plan.featured ? 'elevated' : 'flat'} class="pricing__plan">
        <CardHeader>
          <div class="pricing__name">
            <CardTitle level={4}>{plan.name}</CardTitle>
            {#if plan.featured}<Badge>Most popular</Badge>{/if}
          </div>
          <CardDescription>{plan.blurb}</CardDescription>
        </CardHeader>
        <CardContent>
          <p class="pricing__price">
            <span class="pricing__amount">{money.format(plan.cents / 100)}</span>
            <span class="pricing__period">{plan.period}</span>
          </p>
          <ul class="pricing__features">
            {#each plan.features as feature (feature)}<li>{feature}</li>{/each}
          </ul>
        </CardContent>
        <CardFooter>
          <Button href={`#plan-${plan.id}`} variant={plan.featured ? 'default' : 'outline'}>
            Choose {plan.name}
          </Button>
        </CardFooter>
      </Card>
    {/each}
  </CardGrid>
</section>

<style>
  .pricing {
    display: grid;
    gap: 1.25rem;
  }
  .pricing__title {
    margin: 0;
    font-size: 1.5rem;
  }
  .pricing__name {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .pricing__price {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    margin: 0 0 0.75rem;
  }
  .pricing__amount {
    font-size: 2rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .pricing__period {
    color: var(--tx-muted-foreground, GrayText);
  }
  .pricing__features {
    display: grid;
    gap: 0.375rem;
    margin: 0;
    padding-inline-start: 1.25rem;
  }
</style>
