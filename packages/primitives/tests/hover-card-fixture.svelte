<script lang="ts">
import { HoverCardRoot, HoverCardTrigger } from '../src/hover-card/index.ts';

let { openDelay, closeDelay }: { openDelay: number; closeDelay: number } = $props();
</script>

<HoverCardRoot {openDelay} {closeDelay}>
  <HoverCardTrigger>Profile preview</HoverCardTrigger>
</HoverCardRoot>
