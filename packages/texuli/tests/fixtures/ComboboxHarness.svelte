<script lang="ts">
import type { ComboboxFilter, ComboboxItemData } from '../../src/components/combobox/index.ts';
import { Combobox, MultiSelect } from '../../src/components/combobox/index.ts';

const defaults: ComboboxItemData[] = [
  { value: 'amber', label: 'Amber' },
  { value: 'blue', label: 'Blue' },
  { value: 'jade', label: 'Jade' },
];

let {
  mode = 'single' as 'single' | 'multi',
  items = defaults,
  loadOptions = undefined as
    | ((query: string, signal: AbortSignal) => Promise<readonly ComboboxItemData[]>)
    | undefined,
  disabled = false,
  filter = undefined as ComboboxFilter | undefined,
  name = undefined as string | undefined,
  required = false,
  open = $bindable(false),
  value = $bindable<string | string[]>(''),
  inputValue = $bindable(''),
}: {
  mode?: 'single' | 'multi';
  items?: readonly ComboboxItemData[];
  loadOptions?: (query: string, signal: AbortSignal) => Promise<readonly ComboboxItemData[]>;
  disabled?: boolean;
  filter?: ComboboxFilter;
  name?: string;
  required?: boolean;
  open?: boolean;
  value?: string | string[];
  inputValue?: string;
} = $props();
</script>

<form aria-label="Palette">
{#if mode === 'multi'}
  <label for="cb-input">Colors</label>
  <MultiSelect.Root
    bind:value={value as string[]}
    bind:inputValue
    bind:open
    {items}
    {disabled}
    {loadOptions}
    {filter}
    {name}
    {required}
  >
    <MultiSelect.Field {open} {disabled}>
      <MultiSelect.Chips>
        {#each Array.isArray(value) ? value : [] as selected (selected)}
          <MultiSelect.Chip value={selected} />
        {/each}
      </MultiSelect.Chips>
      <MultiSelect.Input id="cb-input" />
      <MultiSelect.Trigger aria-label="Show colors" />
    </MultiSelect.Field>
    <MultiSelect.Portal>
      <MultiSelect.Content aria-label="Color options">
        <MultiSelect.Loading />
        <MultiSelect.Empty />
        <MultiSelect.Error />
        <MultiSelect.Viewport>
          {#snippet children(item)}
            <MultiSelect.Item value={item.value} label={item.label}>{item.label}</MultiSelect.Item>
          {/snippet}
        </MultiSelect.Viewport>
      </MultiSelect.Content>
    </MultiSelect.Portal>
  </MultiSelect.Root>
{:else}
  <label for="cb-input">Colors</label>
  <Combobox.Root
    bind:value={value as string}
    bind:inputValue
    bind:open
    {items}
    {disabled}
    {loadOptions}
    {filter}
    {name}
    {required}
  >
    <Combobox.Field {open} {disabled}>
      <Combobox.Input id="cb-input" />
      <Combobox.Trigger aria-label="Show colors" />
    </Combobox.Field>
    <Combobox.Portal>
      <Combobox.Content aria-label="Color options">
        <Combobox.Loading />
        <Combobox.Empty />
        <Combobox.Error />
        <Combobox.Viewport>
          {#snippet children(item)}
            <Combobox.Item value={item.value} label={item.label}>{item.label}</Combobox.Item>
          {/snippet}
        </Combobox.Viewport>
      </Combobox.Content>
    </Combobox.Portal>
  </Combobox.Root>
{/if}
</form>
