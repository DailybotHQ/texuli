<script lang="ts">
import { Kpi, KpiRow, Stat } from 'texuli/stat';
</script>

<section data-example="texuli-stat" aria-labelledby="stat-demo-title">
  <h2 id="stat-demo-title">Stat and KPI</h2>

  <h3>Stat (elevated + flat, RTL)</h3>
  <KpiRow label="Harbor Notes stats" minItemWidth="14rem">
    <Stat label="Active notes" value={128} delta={12} hint="vs last week" />
    <Stat label="Churn" value="2.1%" delta={-0.4} positive="down" variant="flat" />
    <div dir="rtl">
      <Stat label="Latency" value="84 ms" delta="-6 ms" trend="down" positive="down" />
    </div>
  </KpiRow>

  <h3>KPI with comparison and link</h3>
  <KpiRow label="Key metrics">
    <Kpi
      label="Signups"
      value={420}
      previous={380}
      href="https://example.com/insights/signups"
    />
    <Kpi label="Churn" value={0.031} previous={0.04} unit="percent" positive="down" />
    <Kpi label="MRR" value={1_245_000} previous={1_180_000} unit="cents" />
    <Kpi label="Loading" value={0} loading />
    <Kpi label="Empty" value={null} empty="No data yet" />
  </KpiRow>

  <h3>Sparkline slot</h3>
  <Stat label="Weekly opens" value={1_840} delta="+8%" trend="up">
    {#snippet sparkline()}
      <svg
        viewBox="0 0 120 28"
        width="100%"
        height="28"
        role="img"
        aria-label="Opens rising over seven days"
      >
        <polyline
          fill="none"
          stroke="var(--tx-primary, Highlight)"
          stroke-width="2"
          points="0,22 20,18 40,20 60,12 80,14 100,6 120,4"
        />
      </svg>
    {/snippet}
  </Stat>
</section>
