<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { ContextMenu, DropdownMenu, Menubar } from '../../src/components/menus/index.ts';

let { p, refs, variant = 'dropdown' }: HarnessProps = $props();
const k = (name: string) => `components/menus/${name}`;
</script>

{#if variant === 'dropdown'}
  <DropdownMenu.Root open>
    <DropdownMenu.Trigger {...p(k('DropdownMenuTrigger'))} bind:ref={refs[k('DropdownMenuTrigger')]}>Actions</DropdownMenu.Trigger>
    <DropdownMenu.Content {...p(k('MenuContent'))} bind:ref={refs[k('MenuContent')]}>
      <DropdownMenu.Item {...p(k('MenuItem'))} bind:ref={refs[k('MenuItem')]}>New</DropdownMenu.Item>
      <DropdownMenu.Separator {...p(k('MenuSeparator'))} bind:ref={refs[k('MenuSeparator')]} />
      <DropdownMenu.Group {...p(k('MenuGroup'))} bind:ref={refs[k('MenuGroup')]}>
        <DropdownMenu.Label {...p(k('MenuLabel'))} bind:ref={refs[k('MenuLabel')]}>View</DropdownMenu.Label>
        <DropdownMenu.CheckboxItem {...p(k('MenuCheckboxItem'))} bind:ref={refs[k('MenuCheckboxItem')]}>Grid</DropdownMenu.CheckboxItem>
      </DropdownMenu.Group>
      <DropdownMenu.RadioGroup value="a" {...p(k('MenuRadioGroup'))} bind:ref={refs[k('MenuRadioGroup')]}>
        <DropdownMenu.RadioItem value="a">A</DropdownMenu.RadioItem>
        <DropdownMenu.RadioItem value="b" {...p(k('MenuRadioItem'))} bind:ref={refs[k('MenuRadioItem')]}>B</DropdownMenu.RadioItem>
      </DropdownMenu.RadioGroup>
      <DropdownMenu.Sub open>
        <DropdownMenu.SubTrigger {...p(k('MenuSubTrigger'))} bind:ref={refs[k('MenuSubTrigger')]}>Share</DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent {...p(k('MenuSubContent'))} bind:ref={refs[k('MenuSubContent')]}>
          <DropdownMenu.Item>Email</DropdownMenu.Item>
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{:else if variant === 'context'}
  <ContextMenu.Root open>
    <ContextMenu.Trigger {...p(k('ContextMenuTrigger'))} bind:ref={refs[k('ContextMenuTrigger')]}>Area</ContextMenu.Trigger>
    <ContextMenu.Content {...p(k('ContextMenuContent'))} bind:ref={refs[k('ContextMenuContent')]}>
      <ContextMenu.Item>Copy</ContextMenu.Item>
    </ContextMenu.Content>
  </ContextMenu.Root>
{:else}
  <Menubar.Root value="file" aria-label="App" {...p(k('MenubarRoot'))} bind:ref={refs[k('MenubarRoot')]}>
    <Menubar.Menu value="file">
      <Menubar.Trigger {...p(k('MenubarTrigger'))} bind:ref={refs[k('MenubarTrigger')]}>File</Menubar.Trigger>
      <Menubar.Content {...p(k('MenubarContent'))} bind:ref={refs[k('MenubarContent')]}>
        <Menubar.Item>New</Menubar.Item>
      </Menubar.Content>
    </Menubar.Menu>
  </Menubar.Root>
{/if}
