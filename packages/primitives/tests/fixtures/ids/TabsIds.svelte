<script lang="ts">
import { Tabs } from '../../../src/tabs/index.ts';
</script>

<Tabs.Root value="a">
  <Tabs.List aria-label="Sections">
    <Tabs.Trigger value="a" id="tab-a">Section A</Tabs.Trigger>
    <Tabs.Trigger value="b" id="tab-b">Section B</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="a" id="panel-a">A</Tabs.Content>
  <Tabs.Content value="b" id="panel-b">B</Tabs.Content>
</Tabs.Root>
