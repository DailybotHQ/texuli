<script lang="ts">
import { Tabs } from '../../src/tabs/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Tabs.Root value="a" {...p('tabs/TabsRoot')} bind:ref={refs['tabs/TabsRoot']}>
  <Tabs.List aria-label="Views" {...p('tabs/TabsList')} bind:ref={refs['tabs/TabsList']}>
    <Tabs.Trigger value="a">A</Tabs.Trigger>
    <Tabs.Trigger value="b" {...p('tabs/TabsTrigger')} bind:ref={refs['tabs/TabsTrigger']}>B</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="a" {...p('tabs/TabsContent')} bind:ref={refs['tabs/TabsContent']}>Panel A</Tabs.Content>
  <Tabs.Content value="b">Panel B</Tabs.Content>
</Tabs.Root>
