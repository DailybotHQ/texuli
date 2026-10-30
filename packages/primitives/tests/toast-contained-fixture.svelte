<script lang="ts">
import { createToastManager, Toast } from '../src/toast/index.ts';

let {
  container = null,
  positioned = undefined,
}: {
  container?: Element | null;
  positioned?: boolean;
} = $props();

const manager = createToastManager();
</script>

<Toast.Provider {manager} label="Notifications">
  <Toast.Viewport mode="contained" {container} {positioned}>
    <ol></ol>
  </Toast.Viewport>
</Toast.Provider>
