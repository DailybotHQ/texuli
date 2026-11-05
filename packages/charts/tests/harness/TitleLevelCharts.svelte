<script lang="ts">
/** tests/heading.test.ts (D-G-020): every figure-titled chart under a host-set title rank. */

import { untrack } from 'svelte';
import FunnelChart from '../../src/flow/FunnelChart.svelte';
import NetworkGraph from '../../src/flow/NetworkGraph.svelte';
import SankeyChart from '../../src/flow/SankeyChart.svelte';
import GeoMap from '../../src/geo/GeoMap.svelte';
import GeoPointMap from '../../src/geo/GeoPointMap.svelte';
import { setChartTitleLevel } from '../../src/heading/index.ts';
import DonutChart from '../../src/part-whole/DonutChart.svelte';
import PieChart from '../../src/part-whole/PieChart.svelte';
import SunburstChart from '../../src/part-whole/SunburstChart.svelte';
import TreemapChart from '../../src/part-whole/TreemapChart.svelte';

let { level, host = true }: { level?: number; host?: boolean } = $props();
// Whether a host sets a rank is fixed per mount; the rank itself stays reactive.
if (untrack(() => host)) setChartTitleLevel(() => level);
const root = { id: 'root', label: 'Root', value: 0 };
</script>

<FunnelChart title="Funnel" steps={[{ id: 'visit', label: 'Visits', value: 8 }]} />
<NetworkGraph title="Network" nodes={[]} links={[]} />
<SankeyChart title="Sankey" nodes={[]} links={[]} />
<GeoMap title="Geo map" description="Fictional regions" data={{}} />
<GeoPointMap title="Geo points" description="Fictional points" points={[]} />
<DonutChart title="Donut" description="Fictional split" data={[]} labels={{}} />
<PieChart title="Pie" description="Fictional split" data={[]} labels={{}} />
<SunburstChart title="Sunburst" description="Fictional tree" {root} labels={{}} />
<TreemapChart title="Treemap" description="Fictional tree" {root} labels={{}} />
