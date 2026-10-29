<script lang="ts">
import type { ComponentProps } from 'svelte';
import type { RefProp } from '../internal/ref.ts';
import SheetContent from './SheetContent.svelte';

type Props = Omit<
  ComponentProps<typeof SheetContent>,
  'modal' | 'drag' | 'snapPoints' | 'activeSnapPoint' | 'onSnapPointChange' | 'dismissible'
> &
  RefProp;
let { ref = $bindable(null), ...rest }: Props = $props();
</script>

<!-- A non-modal detail panel: the page stays usable while it is open. -->
<SheetContent bind:ref {...rest} modal={false} />
