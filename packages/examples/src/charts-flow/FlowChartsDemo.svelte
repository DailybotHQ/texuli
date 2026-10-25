<script lang="ts">
import { FunnelChart, NetworkGraph, SankeyChart } from '@texuli/charts/flow';

const funnelSteps = [
  { id: 'visit', label: 'Visit', value: 1200 },
  { id: 'trial', label: 'Trial', value: 760 },
  { id: 'account', label: 'Account', value: 420 },
  { id: 'paid', label: 'Paid', value: 190 },
] as const;

const nodes = [
  { id: 'site', label: 'Website' },
  { id: 'trial', label: 'Trial' },
  { id: 'paid', label: 'Paid' },
  { id: 'referral', label: 'Referral' },
] as const;

const links = [
  { source: 'site', target: 'trial', value: 760 },
  { source: 'trial', target: 'paid', value: 190 },
  { source: 'referral', target: 'trial', value: 240 },
] as const;

const people = [
  { id: 'ada', label: 'Ada', value: 4 },
  { id: 'lin', label: 'Lin', value: 3 },
  { id: 'sam', label: 'Sam', value: 2 },
  { id: 'ren', label: 'Ren', value: 1 },
] as const;

const connections = [
  { source: 'ada', target: 'lin', value: 3 },
  { source: 'ada', target: 'sam', value: 2 },
  { source: 'lin', target: 'ren', value: 1 },
  { source: 'sam', target: 'ren', value: 2 },
] as const;
</script>

<section class="demo" aria-labelledby="flow-demo-title">
  <h2 id="flow-demo-title">Flow charts</h2>
  <p>Example conversion and collaboration data; values are illustrative.</p>
  <section class="mode light" data-tx-mode="light" aria-labelledby="light-title">
    <h3 id="light-title">Light mode</h3>
    <div class="charts">
      <FunnelChart title="Signup funnel" description="The example signup flow from visit to paid account." steps={funnelSteps} />
      <SankeyChart title="Acquisition flow" description="Website and referrals flow through trials to paid accounts." {nodes} {links} />
      <NetworkGraph title="Team network" description="Connections between four fictional team members." nodes={people} links={connections} />
    </div>
  </section>
  <section class="mode dark" data-tx-mode="dark" aria-labelledby="dark-title">
    <h3 id="dark-title">Dark mode</h3>
    <div class="charts">
      <FunnelChart title="Signup funnel" description="The example signup flow from visit to paid account." steps={funnelSteps} />
      <SankeyChart title="Acquisition flow" description="Website and referrals flow through trials to paid accounts." {nodes} {links} />
      <NetworkGraph title="Team network" description="Connections between four fictional team members." nodes={people} links={connections} />
    </div>
  </section>
</section>

<style>
  .demo { display: grid; gap: 1.5rem; }
  .demo > h2, .demo > p, .mode > h3 { margin-block: 0; }
  .mode { border: 1px solid var(--tx-border); border-radius: 0.75rem; padding: 1rem; }
  .mode.light {
    --tx-background: #ffffff; --tx-foreground: #17212b; --tx-muted-foreground: #465463; --tx-border: #71808f;
    --tx-primary: #005f73; --tx-success: #315c27; --tx-info: #164e9b; --tx-warning: #784900;
    --tx-chart-1: #005f73; --tx-chart-2: #315c27; --tx-chart-3: #164e9b; --tx-chart-4: #784900;
    --tx-chart-5: #a62020; --tx-chart-6: #5d3e8c; --tx-chart-7: #8b3c6c; --tx-chart-8: #005ea8;
    background: var(--tx-background); color: var(--tx-foreground);
  }
  .mode.dark {
    --tx-background: #121820; --tx-foreground: #f0f4f8; --tx-muted-foreground: #c0ccd8; --tx-border: #8394a5;
    --tx-primary: #68d8e8; --tx-success: #9bd97d; --tx-info: #9fc5ff; --tx-warning: #ffd078;
    --tx-chart-1: #68d8e8; --tx-chart-2: #9bd97d; --tx-chart-3: #9fc5ff; --tx-chart-4: #ffd078;
    --tx-chart-5: #ff9999; --tx-chart-6: #d1b4ff; --tx-chart-7: #ffacd8; --tx-chart-8: #a7cfff;
    background: var(--tx-background); color: var(--tx-foreground);
  }
  .charts { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); margin-block-start: 1rem; }
  @media (forced-colors: active) { .mode { border-color: CanvasText; } }

  @media (forced-colors: active) {
    .mode, .dark, [data-tx-mode="dark"] {
      background: Canvas !important;
      color: CanvasText !important;
      border-color: CanvasText !important;
      --tx-background: Canvas;
      --tx-foreground: CanvasText;
      --tx-muted-foreground: CanvasText;
      --tx-border: CanvasText;
      --tx-surface: Canvas;
      --tx-primary: Highlight;
      --tx-primary-foreground: HighlightText;
    }
  }
</style>
