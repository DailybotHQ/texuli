<script lang="ts">
import { ListboxOption, ListboxRoot } from '../../../src/listbox/index.ts';

const items = [
  { value: 'apple', label: 'Apple' },
  { value: 'pear', label: 'Pear' },
];
</script>

<ListboxRoot id="fruit-list" aria-label="Fruit" {items}>
  <ListboxOption value="apple" label="Apple" id="fruit-apple">Apple</ListboxOption>
  <ListboxOption value="pear" label="Pear" id="fruit-pear">Pear</ListboxOption>
</ListboxRoot>
