<script lang="ts">
import type { MenuSelectEvent } from '../../src/menu/index.ts';
import * as Menu from '../../src/menu/index.ts';

interface Props {
  open?: boolean;
  loop?: boolean;
  dir?: 'ltr' | 'rtl';
  keepOpenOnRename?: boolean;
  log?: string[];
}

let {
  open = $bindable(false),
  loop = true,
  dir = 'ltr',
  keepOpenOnRename = false,
  log = [],
}: Props = $props();
let grid = $state(false);
let mixed = $state(true);
let density = $state('comfortable');
let subOpen = $state(false);

function onRename(event: MenuSelectEvent) {
  log.push('rename');
  if (keepOpenOnRename) event.preventDefault();
}
</script>

<div {dir}>
  <button type="button">Before</button>
  <Menu.Root bind:open {loop} onOpenChange={(next) => log.push(`open:${next}`)}>
    <Menu.Trigger>Actions</Menu.Trigger>
    <Menu.Content>
      <Menu.Item textValue="Rename" onSelect={onRename}>Rename</Menu.Item>
      <Menu.Item onSelect={() => log.push('duplicate')}>Duplicate</Menu.Item>
      <Menu.Item disabled onSelect={() => log.push('archive')}>Archive</Menu.Item>
      <Menu.Sub bind:open={subOpen}>
        <Menu.SubTrigger>Share</Menu.SubTrigger>
        <Menu.SubContent>
          <Menu.Item onSelect={() => log.push('email')}>Email</Menu.Item>
          <Menu.Item onSelect={() => log.push('link')}>Copy link</Menu.Item>
        </Menu.SubContent>
      </Menu.Sub>
      <Menu.Separator />
      <Menu.CheckboxItem bind:checked={grid} closeOnSelect={false} onCheckedChange={(next) => log.push(`grid:${next}`)}>
        {#snippet children({ checked })}Grid {checked ? 'on' : 'off'}{/snippet}
      </Menu.CheckboxItem>
      <Menu.CheckboxItem bind:indeterminate={mixed} closeOnSelect={false}>Mixed</Menu.CheckboxItem>
      <Menu.RadioGroup bind:value={density} onValueChange={(next) => log.push(`density:${next}`)}>
        <Menu.GroupHeading>Density</Menu.GroupHeading>
        <Menu.RadioItem value="compact">Compact</Menu.RadioItem>
        <Menu.RadioItem value="comfortable">Comfortable</Menu.RadioItem>
      </Menu.RadioGroup>
      <Menu.Group>
        <Menu.GroupHeading>Danger zone</Menu.GroupHeading>
        <Menu.Item onSelect={() => log.push('delete')}>Delete</Menu.Item>
      </Menu.Group>
    </Menu.Content>
  </Menu.Root>
  <button type="button">After</button>
  <output data-testid="state">{grid}|{mixed}|{density}|{subOpen}</output>
</div>
