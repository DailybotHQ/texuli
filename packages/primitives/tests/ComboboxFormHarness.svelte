<script lang="ts">
import type { ComboboxItemData } from '../src/combobox/context.ts';
import { Combobox, type ComboboxFilter } from '../src/combobox/index.ts';

const cities: ComboboxItemData[] = [
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'America/New_York', label: 'New York' },
  { value: 'Europe/Lisbon', label: 'Lisbon' },
  { value: 'Europe/Zurich', label: 'Zürich' },
];
interface Props {
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  requiredMessage?: string;
  name?: string;
  form?: string;
  filter?: ComboboxFilter;
  defaultValue?: string | readonly string[];
  items?: readonly ComboboxItemData[];
}
let {
  multiple = false,
  disabled = false,
  required = false,
  requiredMessage,
  name = 'city',
  form,
  filter,
  defaultValue,
  items = cities,
}: Props = $props();
</script>

<form aria-label="Trip">
  <label for="city-input">City</label>
  <Combobox.Root
    {items}
    {multiple}
    {disabled}
    {required}
    {requiredMessage}
    {name}
    {form}
    {filter}
    {defaultValue}
  >
    <Combobox.Input id="city-input" />
    <Combobox.Portal>
      <Combobox.Content aria-label="City options">
        <Combobox.Empty />
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
</form>
<form id="other-form" aria-label="Other"></form>
