<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { VirtualListView } from '../../src/virtual-list/index.ts';

let { p, refs, variant }: HarnessProps = $props();
const rows = [
  { id: 'a', label: 'Release notes drafted' },
  { id: 'b', label: 'Onboarding flow reviewed' },
  { id: 'c', label: 'Quarterly plan shared' },
];
</script>

<VirtualListView
  items={rows}
  label="Team feed"
  mode={variant === 'feed' ? 'feed' : 'listbox'}
  {...p('VirtualListView')}
  bind:ref={refs.VirtualListView}
/>
