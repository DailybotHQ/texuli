<script lang="ts">
import { ContextMenu, DropdownMenu, Menubar } from '../../src/components/menus/index.ts';

let {
  mode = 'dropdown' as 'dropdown' | 'context' | 'menubar',
  open = $bindable(false),
  menubarValue = $bindable(''),
  grid = $bindable(false),
  density = $bindable('comfortable'),
}: {
  mode?: 'dropdown' | 'context' | 'menubar';
  open?: boolean;
  menubarValue?: string;
  grid?: boolean;
  density?: string;
} = $props();

const log: string[] = $state([]);
</script>

{#if mode === 'dropdown'}
  <DropdownMenu.Root bind:open>
    <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
    <DropdownMenu.Content>
      <DropdownMenu.Item
        shortcut="⌘N"
        onSelect={() => {
          log.push('new');
        }}
      >
        New file
      </DropdownMenu.Item>
      <DropdownMenu.Item disabled>Disabled</DropdownMenu.Item>
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>Export</DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
          <DropdownMenu.Item
            onSelect={() => {
              log.push('png');
            }}
          >
            PNG
          </DropdownMenu.Item>
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
      <DropdownMenu.Separator />
      <DropdownMenu.CheckboxItem bind:checked={grid}>Show grid</DropdownMenu.CheckboxItem>
      <DropdownMenu.RadioGroup bind:value={density}>
        <DropdownMenu.Label>Density</DropdownMenu.Label>
        <DropdownMenu.RadioItem value="compact">Compact</DropdownMenu.RadioItem>
        <DropdownMenu.RadioItem value="comfortable">Comfortable</DropdownMenu.RadioItem>
      </DropdownMenu.RadioGroup>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{:else if mode === 'context'}
  <ContextMenu.Root bind:open>
    <ContextMenu.Trigger>Canvas region</ContextMenu.Trigger>
    <ContextMenu.Content>
      <ContextMenu.Item
        onSelect={() => {
          log.push('cut');
        }}
      >
        Cut
      </ContextMenu.Item>
      <ContextMenu.Item
        onSelect={() => {
          log.push('copy');
        }}
      >
        Copy
      </ContextMenu.Item>
    </ContextMenu.Content>
  </ContextMenu.Root>
{:else}
  <Menubar.Root bind:value={menubarValue} aria-label="Application">
    <Menubar.Menu value="file">
      <Menubar.Trigger>File</Menubar.Trigger>
      <Menubar.Content>
        <Menubar.Item
          onSelect={() => {
            log.push('new');
          }}
        >
          New
        </Menubar.Item>
        <Menubar.Item
          onSelect={() => {
            log.push('open');
          }}
        >
          Open
        </Menubar.Item>
      </Menubar.Content>
    </Menubar.Menu>
    <Menubar.Menu value="edit">
      <Menubar.Trigger>Edit</Menubar.Trigger>
      <Menubar.Content>
        <Menubar.Item>Paste</Menubar.Item>
      </Menubar.Content>
    </Menubar.Menu>
  </Menubar.Root>
{/if}

<output aria-label="Log">{log.join(',')}</output>
