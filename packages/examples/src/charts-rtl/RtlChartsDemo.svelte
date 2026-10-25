<script lang="ts">
import { LineChart } from '@texuli/charts/cartesian';
import { Gauge } from '@texuli/charts/compact';
import { SankeyChart } from '@texuli/charts/flow';
import { HeatmapChart, ScatterChart } from '@texuli/charts/matrix';

let root = $state<HTMLElement>();
let ready = $state(false);

// Cartesian charts load their interaction chunk lazily; hold a status until no
// plot is still pending, so captures never see the placeholder.
$effect(() => {
  if (!root) return;
  const element = root;
  let frame = 0;
  const check = () => {
    if (element.querySelector('[data-chart-pending]')) frame = requestAnimationFrame(check);
    else ready = true;
  };
  frame = requestAnimationFrame(check);
  return () => cancelAnimationFrame(frame);
});

// Fictional Arabic labels: months, squads, weekdays and funnel stages.
const months = ['يناير', 'فبراير', 'مارس', 'أبريل'];
const series = [
  { id: 'new', label: 'جديدة', points: months.map((x, i) => ({ x, y: [18, 25, 21, 32][i] ?? 0 })) },
  {
    id: 'returning',
    label: 'عائدة',
    points: months.map((x, i) => ({ x, y: [9, 12, 14, 17][i] ?? 0 })),
  },
];
const squads = ['التصميم', 'البناء', 'المراجعة'];
const days = ['الاثنين', 'الثلاثاء', 'الأربعاء'];
const cells = squads.flatMap((y, row) =>
  days.map((x, column) => ({ x, y, value: ((row + 2) * (column + 3)) % 9 }))
);
const points = [
  { id: 'a', label: 'مكتب الشمال', x: 12, y: 40, seriesId: 'onsite' },
  { id: 'b', label: 'مكتب الشرق', x: 28, y: 22, seriesId: 'onsite' },
  { id: 'c', label: 'عن بعد', x: 18, y: 55, seriesId: 'remote' },
];
const nodes = [
  { id: 'site', label: 'الموقع' },
  { id: 'trial', label: 'تجربة' },
  { id: 'paid', label: 'مدفوع' },
];
const links = [
  { source: 'site', target: 'trial', value: 60 },
  { source: 'trial', target: 'paid', value: 35 },
];
</script>

{#if !ready}
  <p role="status">Loading charts…</p>
{/if}
<div class="demo" dir="rtl" lang="ar" data-example="charts-rtl" bind:this={root}>
  <LineChart
    title="الحسابات حسب الشهر"
    description="بيانات وهمية للعرض فقط."
    {series}
  />
  <HeatmapChart title="الجهد حسب اليوم" description="بيانات وهمية للعرض فقط." {cells} />
  <ScatterChart
    title="المكاتب"
    description="بيانات وهمية للعرض فقط."
    {points}
    series={[
      { id: 'onsite', label: 'في الموقع' },
      { id: 'remote', label: 'عن بعد' },
    ]}
  />
  <SankeyChart title="مسار التسجيل" description="بيانات وهمية للعرض فقط." {nodes} {links} />
  <div class="gauge">
    <h3>صحة الخدمة</h3>
    <Gauge label="صحة الخدمة" value={72} thresholds={[40, 70]} />
  </div>
</div>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    padding: 1rem;
    max-inline-size: 48rem;
    color: var(--tx-foreground, CanvasText);
  }
  .gauge h3 {
    margin: 0;
    font-size: 1rem;
  }
</style>
