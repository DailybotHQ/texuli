<script lang="ts">
import { ContextMenu, DropdownMenu, Menubar } from 'texuli/menus';

let open = $state(true);
let grid = $state(true);
let density = $state('comfortable');
let menubarValue = $state('file');
let contextOpen = $state(false);
</script>

<section data-example="texuli-menus" aria-labelledby="tx-menus-title">
  <h2 id="tx-menus-title">Menus</h2>
  <p>
    Harbor Notes chrome — dropdown with shortcuts and submenus, a context region, and an application
    menubar. Shortcuts are visual only.
  </p>

  <h3>DropdownMenu (open)</h3>
  <div data-axis="dropdown" class="panel panel--tall">
    <DropdownMenu.Root bind:open>
      <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item shortcut="⌘N">New note</DropdownMenu.Item>
        <DropdownMenu.Item shortcut="⌘O">Open…</DropdownMenu.Item>
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>Share</DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            <DropdownMenu.Item>Copy link</DropdownMenu.Item>
            <DropdownMenu.Item>Email</DropdownMenu.Item>
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
        <DropdownMenu.Separator />
        <DropdownMenu.CheckboxItem bind:checked={grid}>Show grid</DropdownMenu.CheckboxItem>
        <DropdownMenu.RadioGroup bind:value={density}>
          <DropdownMenu.Label>Density</DropdownMenu.Label>
          <DropdownMenu.RadioItem value="compact">Compact</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="comfortable">Comfortable</DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator />
        <DropdownMenu.Item disabled>Delete (disabled)</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  <h3>Soft variant</h3>
  <div data-axis="soft" class="panel panel--tall">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger variant="soft">Soft menu</DropdownMenu.Trigger>
      <DropdownMenu.Content variant="soft">
        <DropdownMenu.Item>Rename</DropdownMenu.Item>
        <DropdownMenu.Item>Duplicate</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  <h3>ContextMenu</h3>
  <div data-axis="context" class="panel">
    <ContextMenu.Root bind:open={contextOpen}>
      <ContextMenu.Trigger>
        Right-click or long-press this Harbor canvas region (or focus it and press the Menu key).
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.Item shortcut="⌘X">Cut</ContextMenu.Item>
        <ContextMenu.Item shortcut="⌘C">Copy</ContextMenu.Item>
        <ContextMenu.Item shortcut="⌘V">Paste</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item>Inspect</ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  </div>

  <h3>Menubar</h3>
  <div data-axis="menubar" class="panel">
    <Menubar.Root bind:value={menubarValue} aria-label="Harbor Notes">
      <Menubar.Menu value="file">
        <Menubar.Trigger>File</Menubar.Trigger>
        <Menubar.Content>
          <Menubar.Item shortcut="⌘N">New</Menubar.Item>
          <Menubar.Item shortcut="⌘O">Open…</Menubar.Item>
          <Menubar.Separator />
          <Menubar.Item>Export…</Menubar.Item>
        </Menubar.Content>
      </Menubar.Menu>
      <Menubar.Menu value="edit">
        <Menubar.Trigger>Edit</Menubar.Trigger>
        <Menubar.Content>
          <Menubar.Item>Undo</Menubar.Item>
          <Menubar.Item>Redo</Menubar.Item>
        </Menubar.Content>
      </Menubar.Menu>
      <Menubar.Menu value="view">
        <Menubar.Trigger>View</Menubar.Trigger>
        <Menubar.Content>
          <Menubar.CheckboxItem bind:checked={grid}>Grid</Menubar.CheckboxItem>
        </Menubar.Content>
      </Menubar.Menu>
    </Menubar.Root>
  </div>

  <h3>RTL</h3>
  <div data-axis="rtl" dir="rtl" lang="ar" class="panel panel--tall">
    <DropdownMenu.Root open>
      <DropdownMenu.Trigger>إجراءات</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>ملاحظة جديدة</DropdownMenu.Item>
        <DropdownMenu.Item>فتح…</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  <h3>Dark</h3>
  <div data-axis="dark" data-tx-mode="dark" class="panel panel--tall dark-panel">
    <DropdownMenu.Root open>
      <DropdownMenu.Trigger>Dark actions</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item shortcut="⌘S">Save</DropdownMenu.Item>
        <DropdownMenu.Item>Duplicate</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1.25rem;
    padding: 1rem;
    max-inline-size: 40rem;
  }

  .panel {
    min-block-size: 8rem;
    padding: 1rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background, Canvas);
  }

  .panel--tall {
    min-block-size: 14rem;
  }

  .dark-panel {
    background: var(--tx-background, #0a0a0a);
    color: var(--tx-foreground, #fafafa);
  }
</style>
