<script lang="ts">
import { Kbd } from '../../src/components/kbd-code/index.ts';

let { label = 'K' }: { label?: string } = $props();
</script>

<Kbd>{label}</Kbd>
