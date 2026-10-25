<script lang="ts">
import { getPlayerActionAccess } from '../context.ts';
import { getActionFormContext } from './form-context.ts';

let { label }: { label: string } = $props();
const form = getActionFormContext();
const actions = getPlayerActionAccess();
let pending = $derived(form?.pending() === true);
</script>

<!-- Inside an action-form only; its submit becomes an action intent, never a native submission. -->
<button
  type="submit"
  class="tx-player-form-submit"
  data-tx-player-form-submit
  aria-disabled={pending || !actions?.available()}
  disabled={pending}
>
  {label}
</button>
