<script lang="ts">
import { ListboxOption, ListboxRoot } from '../src/listbox/index.ts';

const options = [
  { value: 'amber', label: 'Amber' },
  { value: 'blue', label: 'Blue' },
  { value: 'coral', label: 'Coral', disabled: true },
  { value: 'jade', label: 'Jade' },
];
let value = $state<string | readonly string[] | undefined>();
let active = $state('');
let activeIndex = $state(-1);
interface Props {
  multiple?: boolean;
  disabled?: boolean;
  virtualized?: boolean;
}
let { multiple = false, disabled = false, virtualized = false }: Props = $props();
</script>

<ListboxRoot
  aria-label="Colors"
  bind:value
  {multiple}
  {disabled}
  items={options}
  onActiveChange={(next, index) => {
    active = next;
    activeIndex = index;
  }}
>
  {#each
    (virtualized
      ? options.slice(Math.min(Math.max(activeIndex, 0), options.length - 2), activeIndex < 2 ? 2 : activeIndex + 1)
      : options) as option (option.value)}
    <ListboxOption
      value={option.value}
      label={option.label}
      disabled={option.disabled}
      role={option.value === 'amber' ? 'button' : undefined}
      aria-selected={option.value === 'amber' ? true : undefined}
      data-state={option.value === 'amber' ? 'forged' : undefined}
    >
      {option.label}
    </ListboxOption>
  {/each}
</ListboxRoot>
<output aria-label="Selection">{Array.isArray(value) ? value.join(',') : value}</output>
<output aria-label="Active option">{active}</output>
<output aria-label="Active index">{activeIndex}</output>
