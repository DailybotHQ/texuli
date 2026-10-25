<script lang="ts">
import type { ComponentProps } from 'svelte';
import SheetContent from './SheetContent.svelte';

type Props = Omit<
  ComponentProps<typeof SheetContent>,
  'modal' | 'drag' | 'snapPoints' | 'activeSnapPoint' | 'onSnapPointChange' | 'dismissible'
>;
let { ...rest }: Props = $props();
</script>

<!-- A non-modal detail panel: the page stays usable while it is open. -->
<SheetContent {...rest} modal={false} />
