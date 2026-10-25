<script lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from '../../../../packages/primitives/src/collapsible/index.ts';
</script>

<section aria-label="Collapsible examples">
  <CollapsibleRoot>
    <CollapsibleTrigger>Show shipping details</CollapsibleTrigger>
    <CollapsibleContent>
      <p>Orders ship within two fictional days.</p>
    </CollapsibleContent>
  </CollapsibleRoot>

  <CollapsibleRoot disabled>
    <CollapsibleTrigger>Locked details</CollapsibleTrigger>
    <CollapsibleContent><p>Managed by an administrator.</p></CollapsibleContent>
  </CollapsibleRoot>
</section>
