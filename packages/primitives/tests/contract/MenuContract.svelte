<script lang="ts">
import * as Menu from '../../src/menu/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Menu.Root open>
  <Menu.Trigger {...p('menu/Trigger')} bind:ref={refs['menu/Trigger']}>Open</Menu.Trigger>
  <Menu.Content {...p('menu/Content')} bind:ref={refs['menu/Content']}>
    <Menu.Item {...p('menu/Item')} bind:ref={refs['menu/Item']}>Rename</Menu.Item>
    <Menu.Separator {...p('menu/Separator')} bind:ref={refs['menu/Separator']} />
    <Menu.Group {...p('menu/Group')} bind:ref={refs['menu/Group']}>
      <Menu.GroupHeading {...p('menu/GroupHeading')} bind:ref={refs['menu/GroupHeading']}>View</Menu.GroupHeading>
      <Menu.CheckboxItem {...p('menu/CheckboxItem')} bind:ref={refs['menu/CheckboxItem']}>Grid</Menu.CheckboxItem>
    </Menu.Group>
    <Menu.RadioGroup value="a" {...p('menu/RadioGroup')} bind:ref={refs['menu/RadioGroup']}>
      <Menu.RadioItem value="a" {...p('menu/RadioItem')} bind:ref={refs['menu/RadioItem']}>A</Menu.RadioItem>
      <Menu.RadioItem value="b">B</Menu.RadioItem>
    </Menu.RadioGroup>
    <Menu.Sub open>
      <Menu.SubTrigger {...p('menu/SubTrigger')} bind:ref={refs['menu/SubTrigger']}>Share</Menu.SubTrigger>
      <Menu.SubContent {...p('menu/SubContent')} bind:ref={refs['menu/SubContent']}>
        <Menu.Item>Email</Menu.Item>
      </Menu.SubContent>
    </Menu.Sub>
  </Menu.Content>
</Menu.Root>
