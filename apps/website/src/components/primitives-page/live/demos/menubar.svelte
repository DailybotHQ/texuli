<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['default', 'soft'],
      default: 'default',
    },
    { kind: 'enum', name: 'size', label: 'Style size', options: ['sm', 'md', 'lg'], default: 'md' },
    { kind: 'boolean', name: 'loop', label: 'loop', default: true },
  ],
  keys: [
    {
      keys: ['ArrowRight', 'ArrowLeft'],
      action: 'Next or previous menu (swapped in right to left)',
    },
    { keys: ['Home', 'End'], action: 'First or last menu' },
    { keys: ['Enter', ' ', 'ArrowDown'], action: 'Open the focused menu on its first item' },
    { keys: ['ArrowUp'], action: 'Open the focused menu on its last item' },
    { keys: ['Escape'], action: 'Close the menu, focus returns to its trigger' },
  ],
  uncontrolled: 'No binding: the menubar keeps which menu is open; one Tab stop for the whole bar.',
  controlled:
    'bind:value holds the open menu ("" when closed), so buttons outside can open or close one.',
  code: (v) => `<script lang="ts">
  import * as Menubar from '@texuli/primitives/menubar';
  let value = $state('');
  let wrap = $state(true);
${SCRIPT_END}

<Menubar.Root bind:value aria-label="Editor"${attr('loop', v.loop === true, true)}>
  <Menubar.Menu value="file">
    <Menubar.Trigger>File</Menubar.Trigger>
    <Menubar.Portal>
      <Menubar.Content>
        <Menubar.Item>New</Menubar.Item>
        <Menubar.Sub>
          <Menubar.SubTrigger>Share</Menubar.SubTrigger>
          <Menubar.SubContent>
            <Menubar.Item>Copy link</Menubar.Item>
          </Menubar.SubContent>
        </Menubar.Sub>
      </Menubar.Content>
    </Menubar.Portal>
  </Menubar.Menu>
  <Menubar.Menu value="view">
    <Menubar.Trigger>View</Menubar.Trigger>
    <Menubar.Portal>
      <Menubar.Content>
        <Menubar.CheckboxItem bind:checked={wrap}>Word wrap</Menubar.CheckboxItem>
        <Menubar.Separator />
        <Menubar.RadioGroup value="m" aria-label="Zoom">
          <Menubar.RadioItem value="s">Small</Menubar.RadioItem>
          <Menubar.RadioItem value="m">Medium</Menubar.RadioItem>
        </Menubar.RadioGroup>
      </Menubar.Content>
    </Menubar.Portal>
  </Menubar.Menu>
</Menubar.Root>

${recipeLine('menuContentClass', 'texuli/menus', { size: v.size ?? 'md', variant: v.variant ?? 'default' })}`,
  keyCheck: {
    focus: '[data-demo-part="Trigger"][data-menu="file"]',
    press: 'ArrowRight',
    expect: { selector: '[data-demo-part="Trigger"][data-menu="edit"]:focus', count: 1 },
  },
  controlCheck: {
    act: '[data-demo-act="edit"]',
    expect: {
      selector: '[data-demo-part="Trigger"][data-menu="edit"]',
      attribute: 'aria-expanded',
      value: 'true',
    },
  },
};
</script>

<script lang="ts">
import * as Menubar from '@texuli/primitives/menubar';
import { Button } from 'texuli/button';
import {
  type MenuSize,
  type MenuVariant,
  menubarRootClass,
  menuContentClass,
  menuIndicatorClass,
  menuItemClass,
  menuSeparatorClass,
  menuTriggerClass,
} from 'texuli/menus';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode, dir }: DemoProps = $props();

const variant = $derived<MenuVariant>(str(values, 'variant', 'default') === 'soft' ? 'soft' : 'default');
const size = $derived<MenuSize>(
  (['sm', 'md', 'lg'] as const).find((s) => s === str(values, 'size', 'md')) ?? 'md'
);
const loop = $derived(bool(values, 'loop', true));
const contentClass = $derived(menuContentClass({ size, variant }));
const triggerClass = $derived(menuTriggerClass({ size, variant }));

let value = $state('');
let wrap = $state(true);
let zoom = $state('m');
let last = $state('nothing yet');
</script>

{#snippet item(label: string)}
  <Menubar.Item class={menuItemClass()} data-tx-menu-item data-demo-part="Item" onSelect={() => (last = label)}>
    <span class="tx-menu-item__label">{label}</span>
  </Menubar.Item>
{/snippet}

{#snippet menus()}
  <Menubar.Menu value="file">
    <Menubar.Trigger class={triggerClass} data-tx-menubar-trigger data-size={size} data-variant={variant} data-menu="file" data-demo-part="Trigger">File</Menubar.Trigger>
    <Menubar.Portal>
      <Menubar.Content class={contentClass} data-tx-menubar-content data-size={size} data-variant={variant} data-demo-part="Content">
        {@render item('New')}
        {@render item('Open…')}
        <Menubar.Sub>
          <Menubar.SubTrigger class={menuItemClass()} data-tx-menu-sub-trigger data-demo-part="SubTrigger">
            <span class="tx-menu-item__label">Share</span>
            <span class="tx-menu-sub-chevron" aria-hidden="true">›</span>
          </Menubar.SubTrigger>
          <Menubar.SubContent class={contentClass} data-tx-menu-sub-content data-size={size} data-variant={variant} data-demo-part="SubContent">
            {@render item('Copy link')}
            {@render item('Email team@example.com')}
          </Menubar.SubContent>
        </Menubar.Sub>
      </Menubar.Content>
    </Menubar.Portal>
  </Menubar.Menu>
  <Menubar.Menu value="edit">
    <Menubar.Trigger class={triggerClass} data-tx-menubar-trigger data-size={size} data-variant={variant} data-menu="edit" data-demo-part="Trigger">Edit</Menubar.Trigger>
    <Menubar.Portal>
      <Menubar.Content class={contentClass} data-tx-menubar-content data-size={size} data-variant={variant} data-demo-part="Content">
        {@render item('Undo')}
        {@render item('Redo')}
      </Menubar.Content>
    </Menubar.Portal>
  </Menubar.Menu>
  <Menubar.Menu value="view">
    <Menubar.Trigger class={triggerClass} data-tx-menubar-trigger data-size={size} data-variant={variant} data-menu="view" data-demo-part="Trigger">View</Menubar.Trigger>
    <Menubar.Portal>
      <Menubar.Content class={contentClass} data-tx-menubar-content data-size={size} data-variant={variant} data-demo-part="Content">
        <Menubar.CheckboxItem bind:checked={wrap} closeOnSelect={false} class={menuItemClass()} data-tx-menu-checkbox-item data-demo-part="CheckboxItem">
          {#snippet children({ checked })}
            <span class={menuIndicatorClass()} data-tx-menu-indicator aria-hidden="true">{#if checked}✓{/if}</span>
            <span class="tx-menu-item__label">Word wrap</span>
          {/snippet}
        </Menubar.CheckboxItem>
        <Menubar.Separator class={menuSeparatorClass()} data-tx-menu-separator data-demo-part="Separator" />
        <Menubar.RadioGroup bind:value={zoom} aria-label="Zoom" data-demo-part="RadioGroup">
          {#each [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']] as [option, label] (option)}
            <Menubar.RadioItem value={option ?? ''} closeOnSelect={false} class={menuItemClass()} data-tx-menu-radio-item data-demo-part="RadioItem">
              {#snippet children({ checked })}
                <span class={menuIndicatorClass()} data-tx-menu-indicator aria-hidden="true">{#if checked}●{/if}</span>
                <span class="tx-menu-item__label">{label}</span>
              {/snippet}
            </Menubar.RadioItem>
          {/each}
        </Menubar.RadioGroup>
      </Menubar.Content>
    </Menubar.Portal>
  </Menubar.Menu>
{/snippet}

{#if mode === 'uncontrolled'}
  <Menubar.Root aria-label="Editor" {loop} {dir} class={menubarRootClass()} data-demo-part="Root">
    {@render menus()}
  </Menubar.Root>
{:else}
  <Menubar.Root bind:value aria-label="Notes app" {loop} {dir} class={menubarRootClass()} data-demo-part="Root">
    {@render menus()}
  </Menubar.Root>
  <div class="demo-controls">
    <output data-demo-readout>value: "{value}" · wrap: {wrap} · last: {last}</output>
    <Button size="sm" variant="outline" onclick={() => (value = 'edit')} data-demo-act="edit">Open Edit</Button>
    <Button size="sm" variant="ghost" onclick={() => (value = '')}>Close</Button>
  </div>
{/if}
