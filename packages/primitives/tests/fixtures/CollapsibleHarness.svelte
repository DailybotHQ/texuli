<script lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from '../../src/collapsible/index.ts';

interface Props {
  initialOpen?: boolean;
  disabled?: boolean;
}

let { initialOpen = false, disabled = false }: Props = $props();
let open = $state<boolean | undefined>();
let changes = $state<boolean[]>([]);
</script>

<CollapsibleRoot
  id="shipping"
  bind:open
  defaultOpen={initialOpen}
  {disabled}
  onOpenChange={(next) => (changes = [...changes, next])}
>
  <CollapsibleTrigger>Shipping details</CollapsibleTrigger>
  <CollapsibleContent>
    <p>Orders ship within two fictional days.</p>
  </CollapsibleContent>
</CollapsibleRoot>
<output aria-label="Open state">{open === undefined ? String(initialOpen) : String(open)}</output>
<output aria-label="Open changes">{changes.join(',')}</output>
