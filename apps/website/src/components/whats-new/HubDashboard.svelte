<script lang="ts">
/**
 * /whats-new/ dashboard demo: three widgets of `@texuli/data/dashboard`
 * on a six-column grid; move one with its handle (Space or Enter, arrows,
 * Space or Enter), and the polite live region announces each step.
 */
import { Dashboard, DashboardWidget } from '@texuli/data/dashboard';
</script>

<div class="hub-demo" data-hub-demo="dashboards">
  <Dashboard label="Mini operations" editable columns={6} breakpoint="lg" rowHeight={40} gap="small">
    <DashboardWidget id="orders" title="Orders" x={0} y={0} w={3} h={2}><p class="hub-demo__big">1,284</p></DashboardWidget>
    <DashboardWidget id="uptime" title="Uptime" x={3} y={0} w={3} h={2}><p class="hub-demo__big">99.98%</p></DashboardWidget>
    <DashboardWidget id="tickets" title="Tickets" x={0} y={2} w={6} h={2}><p class="hub-demo__big">6 open</p></DashboardWidget>
  </Dashboard>
</div>
