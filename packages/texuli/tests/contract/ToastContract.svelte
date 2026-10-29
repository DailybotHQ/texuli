<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { Toaster, toast } from '../../src/components/toast/index.ts';
import { resetToastStore } from '../../src/components/toast/toast-store.ts';

let { p, refs }: HarnessProps = $props();
const k = 'components/toast/Toaster';
resetToastStore();
toast.info('Saved', { id: 'saved', duration: 60_000 });
</script>

<Toaster {...p(k)} bind:ref={refs[k]} />
