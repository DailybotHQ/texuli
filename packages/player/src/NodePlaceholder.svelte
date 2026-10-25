<script lang="ts">
import { getPlayerLabels } from './context.ts';
import type { PlayerNodeErrorCode } from './errors.ts';

let {
  id,
  path,
  label,
  reason,
}: { id: string; path: string; label: string; reason: PlayerNodeErrorCode } = $props();

const headingId = $props.id();
const labels = getPlayerLabels();
</script>

<!-- Error detail never reaches the page: only the code, the label and fixed copy. -->
<div
  class="tx-player__placeholder"
  data-reason={reason}
  data-tx-player-error={reason}
  data-tx-player-node={id}
  role="note"
  aria-labelledby={headingId}
>
  <strong id={headingId}>{label}</strong>
  <span>{labels().placeholders[reason]}</span>
  <span class="tx-player__placeholder-path">{labels().position} {path}</span>
</div>
