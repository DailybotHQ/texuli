<script lang="ts">
import { onDestroy, type Snippet, setContext } from 'svelte';
import { TOOLTIP_GROUP_CONTEXT } from './context.ts';
import { createTooltipDelayGroup } from './delay-group.ts';

interface Props {
  delayDuration?: number;
  skipDelayDuration?: number;
  children?: Snippet;
}

let { delayDuration = 300, skipDelayDuration = 300, children }: Props = $props();
const group = createTooltipDelayGroup();
setContext(TOOLTIP_GROUP_CONTEXT, group);
onDestroy(() => group.destroy());

$effect(() => {
  group.configure({ delayDuration, skipDelayDuration });
});
</script>

{@render children?.()}
