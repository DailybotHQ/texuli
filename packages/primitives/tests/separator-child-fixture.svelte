<script lang="ts">
import { Separator } from '../src/separator/index.ts';
</script>

<Separator.Root orientation="vertical" class="rule">
  {#snippet child({ props })}<hr data-testid="custom" {...props} />{/snippet}
</Separator.Root>
