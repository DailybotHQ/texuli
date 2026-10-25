<script lang="ts">
import { Label } from '../src/label/index.ts';

let { onmousedown }: { onmousedown?: (event: MouseEvent) => void } = $props();
</script>

<Label.Root for="target" {onmousedown}>
  {#snippet child({ props })}
    <span {...props} data-testid="child-label">Custom element label</span>
  {/snippet}
</Label.Root>
<input id="target" />
