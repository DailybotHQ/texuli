<script lang="ts">
import { Select } from '../../../src/select/index.ts';

const items = [
  { value: 'free', label: 'Free' },
  { value: 'team', label: 'Team' },
];
</script>

<label for="plan-trigger">Plan</label>
<Select.Root type="single" value="team" {items}>
  <Select.Trigger id="plan-trigger"><Select.Value placeholder="Choose a plan" /></Select.Trigger>
  <Select.Content id="plan-list" aria-label="Plans">
    {#each items as item (item.value)}
      <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
    {/each}
  </Select.Content>
</Select.Root>
