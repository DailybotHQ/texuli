<script lang="ts">
import type { ComboboxItemData } from '../src/combobox/context.ts';
import { Combobox } from '../src/combobox/index.ts';

const colors: ComboboxItemData[] = [
  { value: 'amber', label: 'Amber' },
  { value: 'blue', label: 'Blue' },
  { value: 'coral', label: 'Coral', disabled: true },
  { value: 'jade', label: 'Jade' },
];
interface Props {
  multiple?: boolean;
  disabled?: boolean;
  items?: readonly ComboboxItemData[];
  loadOptions?: (query: string, signal: AbortSignal) => Promise<readonly ComboboxItemData[]>;
}
let { multiple = false, disabled = false, items = colors, loadOptions }: Props = $props();
let value = $state<string | readonly string[]>('');
let inputValue = $state('');
let open = $state(false);
</script>

<label for="colors-input">Colors</label>
<Combobox.Root bind:value bind:inputValue bind:open {items} {multiple} {disabled} {loadOptions}>
  {#if multiple}
    <Combobox.Chips>
      {#each Array.isArray(value) ? value : [] as selected (selected)}
        <Combobox.Chip value={selected} />
        <Combobox.ChipRemove value={selected}>×</Combobox.ChipRemove>
      {/each}
    </Combobox.Chips>
  {/if}
  <Combobox.Input id="colors-input" />
  <Combobox.Trigger aria-label="Show colors">▾</Combobox.Trigger>
  <Combobox.Portal>
    <Combobox.Content aria-label="Color options" class="combobox-list">
      <Combobox.Loading />
      <Combobox.Empty />
      <Combobox.Error />
      <Combobox.Viewport>
        {#snippet children(item)}
          <Combobox.Item value={item.value} label={item.label} disabled={item.disabled}
            >{item.label}</Combobox.Item
          >
        {/snippet}
      </Combobox.Viewport>
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>
<output aria-label="Selection">{Array.isArray(value) ? value.join(',') : value}</output>
<output aria-label="Input value">{inputValue}</output>
<output aria-label="Open state">{String(open)}</output>
<button type="button" onclick={() => (value = 'blue')}>Choose Blue</button>
