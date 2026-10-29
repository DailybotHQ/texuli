<script lang="ts">
import { ListboxOption, ListboxRoot } from '../../src/listbox/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
const items = [
  { value: 'amber', label: 'Amber' },
  { value: 'blue', label: 'Blue' },
];
</script>

<ListboxRoot aria-label="Colors" {items} {...p('listbox/ListboxRoot')} bind:ref={refs['listbox/ListboxRoot']}>
  <ListboxOption value="amber" />
  <ListboxOption value="blue" {...p('listbox/ListboxOption')} bind:ref={refs['listbox/ListboxOption']} />
</ListboxRoot>
