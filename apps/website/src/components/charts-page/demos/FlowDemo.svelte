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

<div class="grid" data-tx-charts-demo="flow">
  <FunnelChart
    title="Signup funnel"
    description="Harbor Notes signup flow from visit to paid account."
    steps={funnelSteps}
  />
  <SankeyChart
    title="Acquisition flow"
    description="Website and referrals flow through trials to paid accounts."
    {nodes}
    {links}
  />
  <NetworkGraph
    title="Team network"
    description="Connections between four fictional Harbor teammates."
    nodes={people}
    links={connections}
  />
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    gap: 1.25rem;
  }
</style>
