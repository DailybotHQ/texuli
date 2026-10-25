<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * DropdownMenu, ContextMenu and Menubar with their parts: real APG menus
 * with arrow keys, typeahead, checkbox and radio items and a submenu.
 */
import { ContextMenu, DropdownMenu, Menubar } from 'texuli/menus';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, num, bool, pick } = readers(() => values);

const SIZES = ['sm', 'md', 'lg'] as const;
const VARIANTS = ['default', 'soft'] as const;

let grid = $state(true);
let density = $state('comfortable');
let last = $state('');
let menubarValue = $state('');

const own = (id: string) => componentId === id;
</script>

<div class="stage" data-tx-menu-stage={componentId}>
  {#if componentId.startsWith('dropdown-menu')}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        size={own('dropdown-menu-trigger') ? pick('size', SIZES, 'md') : 'md'}
        variant={own('dropdown-menu-trigger') ? pick('variant', VARIANTS, 'default') : 'default'}
      >
        Actions
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        size={own('dropdown-menu-content') ? pick('size', SIZES, 'md') : 'md'}
        variant={own('dropdown-menu-content') ? pick('variant', VARIANTS, 'default') : 'default'}
        side={own('dropdown-menu-content') ? pick('side', ['top', 'right', 'bottom', 'left'] as const, 'bottom') : 'bottom'}
        align={own('dropdown-menu-content') ? pick('align', ['start', 'center', 'end'] as const, 'start') : 'start'}
        sideOffset={own('dropdown-menu-content') ? num('sideOffset', 4) : 4}
      >
        <DropdownMenu.Item
          shortcut={own('dropdown-menu-item') ? str('shortcut', '⌘N') : '⌘N'}
          disabled={own('dropdown-menu-item') && bool('disabled')}
          inset={own('dropdown-menu-item') && bool('inset')}
          onSelect={() => (last = 'New note')}
        >
          New note
        </DropdownMenu.Item>
        <DropdownMenu.Item shortcut="⌘O" onSelect={() => (last = 'Open')}>Open…</DropdownMenu.Item>
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>Share</DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            <DropdownMenu.Item onSelect={() => (last = 'Copy link')}>Copy link</DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => (last = 'Email')}>Email</DropdownMenu.Item>
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
  {:else if componentId.startsWith('context-menu')}
    <ContextMenu.Root>
      <ContextMenu.Trigger disabled={own('context-menu-trigger') && bool('disabled')}>
        <span class="region">
          Right-click or long-press this canvas, or focus it and press Shift+F10.
        </span>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.Item shortcut="⌘X" onSelect={() => (last = 'Cut')}>Cut</ContextMenu.Item>
        <ContextMenu.Item shortcut="⌘C" onSelect={() => (last = 'Copy')}>Copy</ContextMenu.Item>
        <ContextMenu.Item shortcut="⌘V" onSelect={() => (last = 'Paste')}>Paste</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.CheckboxItem bind:checked={grid}>Snap to grid</ContextMenu.CheckboxItem>
      </ContextMenu.Content>
    </ContextMenu.Root>
  {:else}
    <Menubar.Root bind:value={menubarValue} aria-label="Harbor Notes" loop={own('menubar') ? bool('loop', true) : true}>
      {#each [{ value: 'file', label: 'File' }, { value: 'edit', label: 'Edit' }, { value: 'view', label: 'View' }] as menu (menu.value)}
        <Menubar.Menu value={menu.value}>
          <Menubar.Trigger
            size={own('menubar-trigger') ? pick('size', SIZES, 'md') : 'md'}
            variant={own('menubar-trigger') ? pick('variant', VARIANTS, 'default') : 'default'}
            disabled={own('menubar-trigger') && menu.value === 'edit' && bool('disabled')}
          >
            {menu.label}
          </Menubar.Trigger>
          <Menubar.Content>
            {#if menu.value === 'view'}
              <Menubar.CheckboxItem bind:checked={grid}>Grid</Menubar.CheckboxItem>
            {:else}
              <Menubar.Item shortcut="⌘N" onSelect={() => (last = `${menu.label}: New`)}>New</Menubar.Item>
              <Menubar.Item onSelect={() => (last = `${menu.label}: Open`)}>Open…</Menubar.Item>
              <Menubar.Separator />
              <Menubar.Item onSelect={() => (last = `${menu.label}: Export`)}>Export…</Menubar.Item>
            {/if}
          </Menubar.Content>
        </Menubar.Menu>
      {/each}
    </Menubar.Root>
  {/if}
  <p class="state" role="status">{last ? `Chose ${last}` : `Grid ${grid ? 'on' : 'off'}`}</p>
</div>

<style>
  .stage {
    display: grid;
    gap: 0.6rem;
    justify-items: start;
  }
  .region {
    display: block;
    padding: 1rem;
    border: 1px dashed var(--tx-border-strong, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    user-select: none;
  }
  .state {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
