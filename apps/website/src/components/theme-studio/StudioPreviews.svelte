<script lang="ts">
/**
 * The five previews of the studio, rendered inside the design-system scope
 * (`DesignSystemProvider` in the island): a component sheet, a dashboard, a
 * deck slide, a document page and an email. Real Texuli components only;
 * everything reads the scope's `--tx-*` variables, so each compile repaints
 * them in one style write. Fictional data only.
 *
 * The email is a static composition, not the renderer's HTML in a frame:
 * `iframe.srcdoc` is a Trusted Types HTML sink on this site (and the frame
 * would inherit the page's hash-only style policy, which blocks the email's
 * inline styles), and `frame-src` admits only this origin, not `blob:`.
 * The real `@texuli/tools/email` output is the "Sample email HTML" export.
 */
import { Alert, Callout } from 'texuli/alert';
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'texuli/card';
import { Checkbox, Switch } from 'texuli/choice';
import { Progress } from 'texuli/feedback';
import { Input } from 'texuli/input';
import { Stat } from 'texuli/stat';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'texuli/table';
import { Tabs } from 'texuli/tabs-accordion';

let { value = $bindable('sheet') }: { value?: string } = $props();

const ITEMS = [
  { value: 'sheet', label: 'Components' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'slide', label: 'Slide' },
  { value: 'document', label: 'Document' },
  { value: 'email', label: 'Email' },
] as const;

const REGIONS = [
  { region: 'East', orders: '512', change: '+9%' },
  { region: 'West', orders: '431', change: '+15%' },
  { region: 'South', orders: '341', change: '+11%' },
];
const BARS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
let notify = $state(true);
</script>

<Tabs items={ITEMS} bind:value label="Preview surface" data-tx-ds-preview-tabs="">
  {#snippet content(item)}
    {#if item.value === 'sheet'}
      <div class="sheet" data-tx-ds-preview="sheet">
        <div class="row">
          <Button type="button">Primary</Button>
          <Button type="button" variant="secondary">Secondary</Button>
          <Button type="button" variant="outline">Outline</Button>
          <Button type="button" variant="ghost">Ghost</Button>
          <Button type="button" variant="destructive">Delete</Button>
        </div>
        <div class="row">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="info">Info</Badge>
        </div>
        <div class="grid2">
          <div class="stack">
            <label class="label" for="ds-preview-email">Email</label>
            <Input id="ds-preview-email" type="email" value="ada@example.com" readonly />
          </div>
          <div class="stack stack--controls">
            <Switch label="Notify me" bind:checked={notify} />
            <Checkbox label="Weekly digest" checked />
          </div>
        </div>
        <Alert tone="success" title="Saved" text="Your changes are live for this preview." />
        <Card>
          <CardHeader>
            <CardTitle level={3}>Harbor notes</CardTitle>
            <CardDescription>A card on the design system's surface and elevation.</CardDescription>
          </CardHeader>
          <CardContent>
            <p class="body">
              Body text, a <a class="link" href="#ds-preview-title">link</a>, and progress below.
            </p>
            <Progress value={64} ariaLabel="Upload progress" />
          </CardContent>
        </Card>
      </div>
    {:else if item.value === 'dashboard'}
      <div class="dashboard" data-tx-ds-preview="dashboard">
        <div class="stats">
          <Stat label="Revenue" value="$48.2k" delta="+4%" trend="up" />
          <Stat label="Orders" value="1,284" delta="+12%" trend="up" />
          <Stat label="Tickets" value="96" delta="-3%" trend="down" />
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
    {:else if item.value === 'slide'}
      <div class="slide" data-tx-ds-preview="slide">
        <p class="slide__eyebrow">Quarterly review</p>
        <p class="slide__title">Orders grew 12% this quarter</p>
        <ul class="slide__list">
          <li>Shipping took 2.1 days on average</li>
          <li>Returns fell to 1.8%</li>
          <li>Two products are low on stock</li>
        </ul>
        <p class="slide__foot">Harbor Supply · fictional data</p>
      </div>
    {:else if item.value === 'document'}
      <article class="doc" data-tx-ds-preview="document">
        <h3 class="doc__title">Release notes, week 44</h3>
        <p class="doc__lead">The type roles, spacing and colors of this page all come from the design system.</p>
        <h4 class="doc__heading">What changed</h4>
        <ul>
          <li>The orders dashboard loads twice as fast.</li>
          <li>Exports keep the brand colors.</li>
        </ul>
        <blockquote class="doc__quote">Best week of the quarter, and the calmest on-call yet.</blockquote>
        <Callout tone="info" title="Heads up" text="Two products are low on stock." />
        <pre class="doc__code"><code>texuli ds check acme.design-system.json</code></pre>
      </article>
    {:else}
      <div class="email-wrap" data-tx-ds-preview="email">
        <div class="email">
          <p class="email__brand">Harbor Supply</p>
          <p class="email__title">Harbor weekly digest</p>
          <p class="email__body">
            Orders grew <strong>12%</strong> over last week. Shipping took 2.1 days on average.
          </p>
          <div class="email__stats">
            <p><span class="email__stat">$48.2k</span> revenue</p>
            <p><span class="email__stat">1,284</span> orders</p>
          </div>
          <Button type="button">Open the dashboard</Button>
          <p class="email__foot">You get this digest weekly. Fictional data, example.com.</p>
        </div>
        <p class="note">
          A static preview built from components. The real email HTML (rendered by
          <code>@texuli/tools/email</code> with this design system) is the “Sample email HTML”
          export: this site's policy does not allow writing generated HTML into a frame.
        </p>
      </div>
    {/if}
  {/snippet}
</Tabs>

<style>
  .sheet,
  .dashboard,
  .doc,
  .email-wrap {
    display: grid;
    gap: var(--tx-space-4);
    padding-block-start: var(--tx-space-3);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--tx-space-2);
    align-items: center;
  }
  .grid2 {
    display: grid;
    gap: var(--tx-space-3);
  }
  @container (min-width: 32rem) {
    .grid2 {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
    }
  }
  .stack {
    display: grid;
    gap: var(--tx-space-1);
  }
  .stack--controls {
    gap: var(--tx-space-2);
  }
  .label {
    font-size: var(--tx-type-label-size);
    font-weight: var(--tx-type-label-weight);
  }
  .body,
  .doc p,
  .doc li {
    margin: 0;
    font-size: var(--tx-type-body-size);
    line-height: var(--tx-type-body-line);
  }
  .body {
    margin-block-end: var(--tx-space-3);
  }
  .link {
    color: var(--tx-link);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: var(--tx-space-3);
  }
  .chart {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--tx-space-2);
    align-items: end;
    block-size: 9rem;
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
    gap: var(--tx-space-3);
    aspect-ratio: 16 / 9;
    margin-block-start: var(--tx-space-3);
    padding: clamp(1rem, 6%, 3rem);
    border-radius: var(--tx-radius-lg);
    background: var(--tx-primary);
    color: var(--tx-primary-foreground);
    box-shadow: var(--tx-elevation-2);
    overflow: hidden;
  }
  .slide__eyebrow {
    margin: 0;
    font-size: var(--tx-type-label-size);
    font-weight: var(--tx-type-label-weight);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .slide__title {
    margin: 0;
    font-family: var(--tx-font-heading, inherit);
    font-size: clamp(1.25rem, 4cqi, var(--tx-type-display-size));
    font-weight: var(--tx-type-display-weight);
    line-height: var(--tx-type-display-line);
    letter-spacing: var(--tx-type-display-tracking);
  }
  .slide__list {
    margin: 0;
    padding-inline-start: 1.25rem;
    display: grid;
    gap: var(--tx-space-1);
  }
  .slide__foot {
    margin: 0;
    font-size: var(--tx-type-caption-size);
  }
  .doc {
    max-inline-size: 40rem;
  }
  .doc__title,
  .doc__heading {
    margin: 0;
    font-family: var(--tx-font-heading, inherit);
    color: var(--tx-foreground);
  }
  .doc__title {
    font-size: var(--tx-type-title-size);
    font-weight: var(--tx-type-title-weight);
    line-height: var(--tx-type-title-line);
  }
  .doc__heading {
    font-size: var(--tx-type-heading-size);
    font-weight: var(--tx-type-heading-weight);
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
    padding-inline-start: var(--tx-space-4);
    border-inline-start: 3px solid var(--tx-primary);
    font-style: italic;
  }
  .doc__code {
    margin: 0;
    padding: var(--tx-space-3);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-muted);
    color: var(--tx-foreground);
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: var(--tx-type-code-size);
    overflow-x: auto;
  }
  .email-wrap {
    justify-items: center;
    padding: var(--tx-space-4);
    background: var(--tx-muted);
    border-radius: var(--tx-radius, 0.5rem);
  }
  .email {
    display: grid;
    gap: var(--tx-space-3);
    justify-items: start;
    inline-size: min(100%, 37.5rem);
    padding: var(--tx-space-6);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    border: 1px solid var(--tx-border);
  }
  .email p {
    margin: 0;
  }
  .email__brand {
    font-weight: 700;
    color: var(--tx-primary);
  }
  .email__title {
    font-family: var(--tx-font-heading, inherit);
    font-size: var(--tx-type-heading-size);
    font-weight: var(--tx-type-heading-weight);
  }
  .email__stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--tx-space-6);
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
  .note {
    margin: 0;
    max-inline-size: 37.5rem;
    font-size: 0.8125rem;
    color: var(--tx-foreground);
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
