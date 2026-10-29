<script lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from '../../src/collapsible/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<CollapsibleRoot {...p('collapsible/Root')} bind:ref={refs['collapsible/Root']}>
  <CollapsibleTrigger {...p('collapsible/Trigger')} bind:ref={refs['collapsible/Trigger']}>More</CollapsibleTrigger>
  <CollapsibleContent {...p('collapsible/Content')} bind:ref={refs['collapsible/Content']}>Body</CollapsibleContent>
</CollapsibleRoot>
