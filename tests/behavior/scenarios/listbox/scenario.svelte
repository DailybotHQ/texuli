<script lang="ts">
import { ListboxOption, ListboxRoot } from '../../../../packages/primitives/src/listbox/index.ts';

const options = [
  { value: 'amber', label: 'Amber' },
  { value: 'blue', label: 'Blue' },
  { value: 'coral', label: 'Coral', disabled: true },
  { value: 'jade', label: 'Jade' },
];
let single = $state('amber');
let multiple = $state<readonly string[]>(['amber']);
</script>

<section aria-label="Listbox examples">
  <ListboxRoot aria-label="Colors" items={options} bind:value={single}>
    {#each options as option (option.value)}
      <ListboxOption value={option.value} label={option.label} disabled={option.disabled}>
        {option.label}
      </ListboxOption>
    {/each}
  </ListboxRoot>
  <ListboxRoot aria-label="Multiple colors" items={options} multiple bind:value={multiple}>
    {#each options as option (option.value)}
      <ListboxOption value={option.value} label={option.label} disabled={option.disabled}>
        {option.label}
      </ListboxOption>
    {/each}
  </ListboxRoot>
</section>
