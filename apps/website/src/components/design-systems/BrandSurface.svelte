<script lang="ts">
/**
 * One surface (dashboard, deck slide, document page or email) under one
 * example brand, for /design-systems/ (PLAN_011 T-site-0100). Rendered on the
 * server only (no client directive): `DesignSystemProvider` writes the scope
 * attributes in markup and provides the brand's component defaults
 * (Ledgerline's small buttons, Quillmark's outline buttons), and the brand's
 * variables come from `/design-systems/brands.css` (`designSystemStyle`). The
 * same content under every brand, fictional data only. Real Texuli
 * components; the slide, document and email are compositions of them, as in
 * the studio (`StudioPreviews.svelte`).
 */
import type { ApplicableDesignSystem } from '@texuli/tokens/design-system/apply';
import { Callout } from 'texuli/alert';
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { DesignSystemProvider } from 'texuli/design-system';
import { Stat } from 'texuli/stat';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'texuli/table';
import type { Surface } from './page.ts';

let { compiled, surface }: { compiled: ApplicableDesignSystem; surface: Surface } = $props();

const REGIONS = [
  { region: 'East', orders: '512', change: '+9%' },
  { region: 'West', orders: '431', change: '+15%' },
  { region: 'South', orders: '341', change: '+11%' },
];
const BARS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
</script>

<DesignSystemProvider {compiled} mode="light" class="ds-surface" data-ds-surface={surface}>
  {#if surface === 'dashboard'}
    <div class="dashboard">
      <div class="stats">
        <Stat label="Revenue" value="$48.2k" delta="+4%" trend="up" />
        <Stat label="Orders" value="1,284" delta="+12%" trend="up" />
      </div>
      <div class="chart" role="img" aria-label="Orders per day, Monday to Friday, rising from 160 to 214">
        {#each BARS as day, index (day)}
          <div class="chart__col">
            <span class={`chart__bar chart__bar--${index + 1}`}></span>
            <span class="chart__day" aria-hidden="true">{day}</span>
          </div>
        {/each}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Region</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead>Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each REGIONS as row (row.region)}
            <TableRow>
              <TableCell>{row.region}</TableCell>
              <TableCell>{row.orders}</TableCell>
              <TableCell>{row.change}</TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    </div>
  {:else if surface === 'slide'}
    <div class="slide" data-ds-brand-fill="">
      <p class="slide__eyebrow">Quarterly review</p>
      <p class="slide__title">Orders grew 12% this quarter</p>
      <ul class="slide__list">
        <li>Shipping took 2.1 days on average</li>
        <li>Returns fell to 1.8%</li>
      </ul>
      <p class="slide__foot">Harbor Supply · fictional data</p>
    </div>
  {:else if surface === 'document'}
    <div class="doc">
      <p class="doc__title">Release notes, week 44</p>
      <p class="doc__lead">Type roles, spacing and colors all come from the design system.</p>
      <ul>
        <li>The orders dashboard loads twice as fast.</li>
        <li>Exports keep the brand colors.</li>
      </ul>
      <blockquote class="doc__quote">Best week of the quarter, and the calmest on-call yet.</blockquote>
      <Callout tone="info" title="Heads up" text="Two products are low on stock." />
      <p class="doc__tags"><Badge>Shipped</Badge> <Badge variant="secondary">Week 44</Badge></p>
    </div>
  {:else}
    <div class="email-wrap">
      <div class="email">
        <p class="email__brand">Harbor Supply</p>
        <p class="email__title">Harbor weekly digest</p>
        <p class="email__body">Orders grew <strong>12%</strong> over last week.</p>
        <div class="email__stats">
          <p><span class="email__stat">$48.2k</span> revenue</p>
          <p><span class="email__stat">1,284</span> orders</p>
        </div>
        <Button type="button">Open the dashboard</Button>
        <p class="email__foot">You get this digest weekly. Fictional data, example.com.</p>
      </div>
    </div>
  {/if}
</DesignSystemProvider>

<style>
  :global(.ds-surface) {
    container-type: inline-size;
    block-size: 100%;
    box-sizing: border-box;
    padding: var(--tx-space-4);
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius-lg, 0.75rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    font-family: var(--tx-type-body-family);
    font-size: var(--tx-type-body-size);
    line-height: var(--tx-type-body-line);
  }
  .dashboard,
  .doc {
    display: grid;
    gap: var(--tx-space-3);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: var(--tx-space-3);
  }
  .chart {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--tx-space-2);
    align-items: end;
    block-size: 7rem;
    padding: var(--tx-space-3);
    border: 1px solid var(--tx-chart-grid, var(--tx-border));
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface);
  }
  .chart__col {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    align-items: end;
    block-size: 100%;
    gap: var(--tx-space-1);
    text-align: center;
  }
  .chart__bar {
    display: block;
    border-radius: var(--tx-radius-sm) var(--tx-radius-sm) 0 0;
  }
  .chart__bar--1 {
    block-size: 60%;
    background: var(--tx-chart-1);
  }
  .chart__bar--2 {
    block-size: 66%;
    background: var(--tx-chart-2);
  }
  .chart__bar--3 {
    block-size: 76%;
    background: var(--tx-chart-3);
  }
  .chart__bar--4 {
    block-size: 84%;
    background: var(--tx-chart-4);
  }
  .chart__bar--5 {
    block-size: 96%;
    background: var(--tx-chart-5);
  }
  .chart__day {
    font-size: var(--tx-type-caption-size);
    color: var(--tx-chart-axis, var(--tx-muted-foreground));
  }
  .slide {
    display: grid;
    align-content: center;
    gap: var(--tx-space-2);
    aspect-ratio: 16 / 9;
    padding: clamp(0.75rem, 6%, 2rem);
    border-radius: var(--tx-radius-lg);
    background: var(--tx-primary);
    color: var(--tx-primary-foreground);
    box-shadow: var(--tx-elevation-2);
  }
  .slide p,
  .doc p,
  .email p {
    margin: 0;
  }
  .slide__eyebrow {
    font-size: var(--tx-type-label-size);
    font-weight: var(--tx-type-label-weight);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .slide__title {
    font-family: var(--tx-type-display-family);
    font-size: clamp(1.125rem, 7cqi, var(--tx-type-title-size));
    font-weight: var(--tx-type-display-weight);
    line-height: var(--tx-type-display-line);
  }
  .slide__list {
    margin: 0;
    padding-inline-start: 1.25rem;
  }
  .slide__foot {
    font-size: var(--tx-type-label-size);
  }
  .doc__title {
    font-family: var(--tx-type-title-family);
    font-size: var(--tx-type-title-size);
    font-weight: var(--tx-type-title-weight);
    line-height: var(--tx-type-title-line);
  }
  .doc__lead {
    color: var(--tx-muted-foreground);
  }
  .doc ul {
    margin: 0;
    padding-inline-start: 1.25rem;
  }
  .doc__quote {
    margin: 0;
    padding-inline-start: var(--tx-space-3);
    border-inline-start: 3px solid var(--tx-primary);
    font-style: italic;
  }
  .doc__tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--tx-space-2);
  }
  .email-wrap {
    padding: var(--tx-space-3);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-muted);
  }
  .email {
    display: grid;
    gap: var(--tx-space-3);
    justify-items: start;
    padding: var(--tx-space-4);
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
  }
  .email__brand {
    font-weight: 700;
    color: var(--tx-link);
  }
  .email__title {
    font-family: var(--tx-type-heading-family);
    font-size: var(--tx-type-heading-size);
    font-weight: var(--tx-type-heading-weight);
  }
  .email__stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--tx-space-4);
  }
  .email__stat {
    display: block;
    font-size: var(--tx-type-title-size);
    font-weight: 700;
  }
  .email__foot {
    font-size: var(--tx-type-caption-size);
    color: var(--tx-muted-foreground);
  }
  @media (forced-colors: active) {
    .chart__bar {
      background: CanvasText;
    }
    .slide,
    .email,
    .chart {
      border: 1px solid CanvasText;
    }
  }
</style>
