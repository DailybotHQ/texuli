<script lang="ts">
import { HoverCardContent, HoverCardRoot, HoverCardTrigger } from '../../src/hover-card/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<HoverCardRoot open>
  <HoverCardTrigger {...p('hover-card/HoverCardTrigger')} bind:ref={refs['hover-card/HoverCardTrigger']}>Ada</HoverCardTrigger>
  <HoverCardContent aria-label="Profile" {...p('hover-card/HoverCardContent')} bind:ref={refs['hover-card/HoverCardContent']}>Card</HoverCardContent>
</HoverCardRoot>
