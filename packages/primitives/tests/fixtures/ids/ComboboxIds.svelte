<script lang="ts">
import { Combobox } from '../../../src/combobox/index.ts';

const items = [
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'porto', label: 'Porto' },
];
</script>

<label for="city-input">City</label>
<Combobox.Root {items}>
  <Combobox.Input id="city-input" />
  <Combobox.Trigger aria-label="Show cities">v</Combobox.Trigger>
  <Combobox.Content id="city-list" aria-label="Cities">
    <Combobox.Item value="lisbon" label="Lisbon">Lisbon</Combobox.Item>
    <Combobox.Item value="porto" label="Porto">Porto</Combobox.Item>
  </Combobox.Content>
</Combobox.Root>
