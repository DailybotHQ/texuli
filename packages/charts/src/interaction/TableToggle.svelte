<script lang="ts">
import './interaction.css';

let {
  open = $bindable(false),
  showLabel = 'Show data table',
  hideLabel = 'Hide data table',
}: {
  open?: boolean;
  showLabel?: string;
  hideLabel?: string;
} = $props();
</script>

<button
  type="button"
  class="tx-chart-table-toggle"
  data-chart-table-toggle=""
  aria-expanded={open}
  onclick={() => (open = !open)}
>
  {open ? hideLabel : showLabel}
</button>
