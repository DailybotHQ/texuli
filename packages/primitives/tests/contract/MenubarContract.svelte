<script lang="ts">
import * as Menubar from '../../src/menubar/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Menubar.Root value="file" aria-label="App" {...p('menubar/Root')} bind:ref={refs['menubar/Root']}>
  <Menubar.Menu value="file">
    <Menubar.Trigger {...p('menubar/Trigger')} bind:ref={refs['menubar/Trigger']}>File</Menubar.Trigger>
    <Menubar.Content {...p('menubar/Content')} bind:ref={refs['menubar/Content']}>
      <Menubar.Item>New</Menubar.Item>
    </Menubar.Content>
  </Menubar.Menu>
  <Menubar.Menu value="edit">
    <Menubar.Trigger>Edit</Menubar.Trigger>
    <Menubar.Content><Menubar.Item>Undo</Menubar.Item></Menubar.Content>
  </Menubar.Menu>
</Menubar.Root>
