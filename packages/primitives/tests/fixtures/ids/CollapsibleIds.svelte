<script lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from '../../../src/collapsible/index.ts';
</script>

<CollapsibleRoot open>
  <CollapsibleTrigger id="details-trigger">Details</CollapsibleTrigger>
  <CollapsibleContent id="details-content">More about the order.</CollapsibleContent>
</CollapsibleRoot>
