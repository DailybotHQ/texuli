<script lang="ts">
// Uncontrolled single-selection widgets that start on a later item: plain
// values (no binding) for RadioGroup and Tabs, defaultValue for ToggleGroup.
import { RadioGroup } from '../../src/radio-group/index.ts';
import { Tabs } from '../../src/tabs/index.ts';
import { ToggleGroup } from '../../src/toggle/index.ts';
</script>

<button type="button">Before</button>
<span id="plan-label">Plan</span>
<RadioGroup.Root aria-labelledby="plan-label" value="team">
  {#each ['free', 'team', 'business'] as plan (plan)}
    <RadioGroup.Item id="plan-{plan}" value={plan} />
    <label for="plan-{plan}">{plan}</label>
  {/each}
</RadioGroup.Root>

<Tabs.Root value="b">
  <Tabs.List aria-label="Sections">
    <Tabs.Trigger value="a">Section A</Tabs.Trigger>
    <Tabs.Trigger value="b">Section B</Tabs.Trigger>
    <Tabs.Trigger value="c">Section C</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="a">A</Tabs.Content>
  <Tabs.Content value="b">B</Tabs.Content>
  <Tabs.Content value="c">C</Tabs.Content>
</Tabs.Root>

<ToggleGroup.Root type="single" defaultValue="center" aria-label="Align">
  <ToggleGroup.Item value="left" aria-label="Left">L</ToggleGroup.Item>
  <ToggleGroup.Item value="center" aria-label="Center">C</ToggleGroup.Item>
  <ToggleGroup.Item value="right" aria-label="Right">R</ToggleGroup.Item>
</ToggleGroup.Root>
