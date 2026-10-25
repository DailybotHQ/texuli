<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'side',
      label: 'side',
      options: ['bottom', 'top', 'right'],
      default: 'bottom',
    },
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
      keys: ['Enter', ' ', 'ArrowDown'],
      action: 'On the trigger: open with the first item focused',
    },
    {
      keys: ['ArrowUp'],
      action: 'On the trigger: open with the last item focused; in the menu: previous item',
    },
    { keys: ['ArrowRight'], action: 'Open the submenu (ArrowLeft in right to left)' },
    { keys: ['ArrowLeft'], action: 'Close the submenu (ArrowRight in right to left)' },
    { keys: ['Escape'], action: 'Close the menu and return focus to the trigger' },
    { keys: ['Tab'], action: 'Close every level and leave the menu' },
  ],
  uncontrolled: 'No binding: the menu, its check and its radio choice keep their own state.',
  controlled:
    'bind:open, bind:checked and bind:value keep everything in your state; a button outside opens it.',
  code: (v) => `<script lang="ts">
  import * as Menu from '@texuli/primitives/menu';
  let open = $state(false);
  let grid = $state(true);
  let density = $state('comfortable');
${SCRIPT_END}

<Menu.Root bind:open${attr('loop', v.loop === true, true)}>
  <Menu.Trigger>View</Menu.Trigger>
  <Menu.Portal>
    <Menu.Content${attr('side', String(v.side), 'bottom')}>
      <Menu.Item onSelect={() => newFile()}>New file</Menu.Item>
      <Menu.Sub>
        <Menu.SubTrigger>Export</Menu.SubTrigger>
        <Menu.SubContent>
          <Menu.Item>PNG</Menu.Item>
          <Menu.Item>SVG</Menu.Item>
        </Menu.SubContent>
      </Menu.Sub>
      <Menu.CheckboxItem bind:checked={grid} closeOnSelect={false}>Show grid</Menu.CheckboxItem>
      <Menu.Separator />
      <Menu.RadioGroup bind:value={density} aria-label="Density">
        <Menu.RadioItem value="compact">Compact</Menu.RadioItem>
        <Menu.RadioItem value="comfortable">Comfortable</Menu.RadioItem>
      </Menu.RadioGroup>
      <Menu.Group>
        <Menu.GroupHeading>Share</Menu.GroupHeading>
        <Menu.Item>Copy link</Menu.Item>
      </Menu.Group>
    </Menu.Content>
  </Menu.Portal>
</Menu.Root>

${recipeLine('menuContentClass', 'texuli/menus', { size: v.size ?? 'md', variant: v.variant ?? 'default' })}`,
  keyCheck: {
    focus: '[data-demo-part="Trigger"]',
    press: 'ArrowDown',
    expect: { selector: '[data-demo-part="Item"][data-item="new"]:focus', count: 1 },
  },
  controlCheck: {
    act: '[data-demo-act="open"]',
    expect: { selector: '[data-demo-part="Content"]', count: 1 },
  },
};
</script>

<script lang="ts">
import * as Menu from '@texuli/primitives/menu';
import { Button } from 'texuli/button';
import { Kbd } from 'texuli/kbd-code';
import {
  type MenuSize,
  type MenuVariant,
  menuContentClass,
  menuIndicatorClass,
  menuItemClass,
  menuLabelClass,
  menuSeparatorClass,
  menuShortcutClass,
  menuTriggerClass,
} from 'texuli/menus';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const side = $derived(
  (['bottom', 'top', 'right'] as const).find((s) => s === str(values, 'side', 'bottom')) ?? 'bottom'
);
const variant = $derived<MenuVariant>(str(values, 'variant', 'default') === 'soft' ? 'soft' : 'default');
const size = $derived<MenuSize>(
  (['sm', 'md', 'lg'] as const).find((s) => s === str(values, 'size', 'md')) ?? 'md'
);
const loop = $derived(bool(values, 'loop', true));
const contentClass = $derived(menuContentClass({ size, variant }));

let open = $state(false);
let grid = $state(true);
let density = $state('comfortable');
let last = $state('nothing yet');
</script>

{#snippet radios()}
  {#each ['compact', 'comfortable', 'spacious'] as option (option)}
    <Menu.RadioItem value={option} closeOnSelect={false} class={menuItemClass()} data-tx-menu-radio-item data-demo-part="RadioItem">
      {#snippet children({ checked })}
        <span class={menuIndicatorClass()} data-tx-menu-indicator aria-hidden="true">{#if checked}●{/if}</span>
        <span class="tx-menu-item__label">{option[0]?.toUpperCase()}{option.slice(1)}</span>
      {/snippet}
    </Menu.RadioItem>
  {/each}
{/snippet}

{#snippet body()}
  <Menu.Trigger class={menuTriggerClass({ size, variant })} data-tx-dropdown-menu-trigger data-demo-part="Trigger">View</Menu.Trigger>
  <Menu.Portal>
    <Menu.Content {side} class={contentClass} data-tx-menu-content data-size={size} data-variant={variant} data-demo-part="Content">
      <Menu.Item class={menuItemClass()} data-tx-menu-item data-item="new" data-demo-part="Item" onSelect={() => (last = 'New file')}>
        <span class="tx-menu-item__label">New file</span>
        <Kbd class={menuShortcutClass()} data-tx-menu-shortcut>N</Kbd>
      </Menu.Item>
      <Menu.Sub>
        <Menu.SubTrigger class={menuItemClass()} data-tx-menu-sub-trigger data-demo-part="SubTrigger">
          <span class="tx-menu-item__label">Export</span>
          <span class="tx-menu-sub-chevron" aria-hidden="true">›</span>
        </Menu.SubTrigger>
        <Menu.SubContent class={contentClass} data-tx-menu-sub-content data-size={size} data-variant={variant} data-demo-part="SubContent">
          {#each ['PNG', 'SVG', 'WebM'] as format (format)}
            <Menu.Item class={menuItemClass()} data-tx-menu-item data-demo-part="Item" onSelect={() => (last = `Export ${format}`)}>
              <span class="tx-menu-item__label">{format}</span>
            </Menu.Item>
          {/each}
        </Menu.SubContent>
      </Menu.Sub>
      {#if mode === 'uncontrolled'}
        <Menu.CheckboxItem checked={true} closeOnSelect={false} class={menuItemClass()} data-tx-menu-checkbox-item data-demo-part="CheckboxItem">
          {#snippet children({ checked })}
            <span class={menuIndicatorClass()} data-tx-menu-indicator aria-hidden="true">{#if checked}✓{/if}</span>
            <span class="tx-menu-item__label">Show grid</span>
          {/snippet}
        </Menu.CheckboxItem>
      {:else}
        <Menu.CheckboxItem bind:checked={grid} closeOnSelect={false} class={menuItemClass()} data-tx-menu-checkbox-item data-demo-part="CheckboxItem">
          {#snippet children({ checked })}
            <span class={menuIndicatorClass()} data-tx-menu-indicator aria-hidden="true">{#if checked}✓{/if}</span>
            <span class="tx-menu-item__label">Show grid</span>
          {/snippet}
        </Menu.CheckboxItem>
      {/if}
      <Menu.Separator class={menuSeparatorClass()} data-tx-menu-separator data-demo-part="Separator" />
      {#if mode === 'uncontrolled'}
        <Menu.RadioGroup value="comfortable" aria-label="Density" data-demo-part="RadioGroup">{@render radios()}</Menu.RadioGroup>
      {:else}
        <Menu.RadioGroup bind:value={density} aria-label="Density" data-demo-part="RadioGroup">{@render radios()}</Menu.RadioGroup>
      {/if}
      <Menu.Separator class={menuSeparatorClass()} data-tx-menu-separator data-demo-part="Separator" />
      <Menu.Group data-tx-menu-group data-demo-part="Group">
        <Menu.GroupHeading class={menuLabelClass()} data-tx-menu-label data-demo-part="GroupHeading">Share</Menu.GroupHeading>
        <Menu.Item class={menuItemClass()} data-tx-menu-item data-demo-part="Item" onSelect={() => (last = 'Copy link')}>
          <span class="tx-menu-item__label">Copy link</span>
        </Menu.Item>
        <Menu.Item disabled class={menuItemClass({ disabled: true })} data-tx-menu-item data-demo-part="Item">
          <span class="tx-menu-item__label">Email (unavailable)</span>
        </Menu.Item>
      </Menu.Group>
    </Menu.Content>
  </Menu.Portal>
{/snippet}

{#if mode === 'uncontrolled'}
  <Menu.Root {loop}>{@render body()}</Menu.Root>
{:else}
  <Menu.Root bind:open {loop}>{@render body()}</Menu.Root>
  <div class="demo-controls">
    <output data-demo-readout>open: {open} · grid: {grid} · density: {density} · last: {last}</output>
    <Button size="sm" variant="outline" onclick={() => (open = true)} data-demo-act="open">Open from outside</Button>
    <Button size="sm" variant="ghost" onclick={() => (density = 'compact')}>Set compact</Button>
  </div>
{/if}
