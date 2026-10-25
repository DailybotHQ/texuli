<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md', 'lg'], default: 'md' },
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['default', 'soft'],
      default: 'default',
    },
    { kind: 'boolean', name: 'loop', label: 'loop', default: true },
    { kind: 'boolean', name: 'disabled', label: 'Trigger disabled', default: false },
  ],
  keys: [
    {
      keys: ['ContextMenu', 'F10'],
      action: 'Menu key, or Shift+F10: open under the focused element',
    },
    { keys: ['ArrowDown', 'ArrowUp'], action: 'Move between items' },
    { keys: ['Enter', ' '], action: 'Choose the focused item' },
    {
      keys: ['ArrowRight', 'ArrowLeft'],
      action: 'Open or close the submenu (mirrored in right to left)',
    },
    { keys: ['Escape'], action: 'Close and return focus to where it was' },
  ],
  uncontrolled:
    'Right-click, Ctrl+click or long-press the canvas (or focus the shape and press Shift+F10); the menu manages itself.',
  controlled:
    'bind:open lets code open or close the menu, which opens at the region when no pointer is involved.',
  code: (v) => `<script lang="ts">
  import { ContextMenu } from '@texuli/primitives/context-menu';
  let open = $state(false);
${SCRIPT_END}

<ContextMenu.Root bind:open${attr('loop', v.loop !== false, true)}>
  <ContextMenu.Trigger${attr('disabled', v.disabled === true, false)}>
    <button type="button">Selected shape</button>
  </ContextMenu.Trigger>
  <ContextMenu.Content>
    <ContextMenu.Item onSelect={() => duplicate()}>Duplicate</ContextMenu.Item>
    <ContextMenu.CheckboxItem bind:checked={snap}>Snap to grid</ContextMenu.CheckboxItem>
  </ContextMenu.Content>
</ContextMenu.Root>

${recipeLine('menuContentClass', 'texuli/menus', { size: v.size ?? 'md', variant: v.variant ?? 'default' })}`,
  keyCheck: {
    open: '[data-demo-part="ContextMenu.Trigger"]',
    openWith: 'contextmenu',
    focus: '[role="menuitem"]',
    press: 'ArrowDown',
    expect: { selector: '[data-demo-item="front"]:focus', count: 1 },
  },
  controlCheck: {
    act: '[data-demo-act="open"]',
    expect: { selector: '[data-demo-part="ContextMenu.Content"]', count: 1 },
  },
};
</script>

<script lang="ts">
import { ContextMenu } from '@texuli/primitives/context-menu';
import { Button, buttonVariants } from 'texuli/button';
import {
  contextTriggerClass,
  type MenuSize,
  type MenuVariant,
  menuContentClass,
  menuIndicatorClass,
  menuItemClass,
  menuSeparatorClass,
} from 'texuli/menus';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const size = $derived<MenuSize>(
  (['sm', 'md', 'lg'] as const).find((option) => option === str(values, 'size')) ?? 'md'
);
const variant = $derived<MenuVariant>(str(values, 'variant') === 'soft' ? 'soft' : 'default');
const loop = $derived(bool(values, 'loop', true));
const disabled = $derived(bool(values, 'disabled'));

let open = $state(false);
let snap = $state(true);
let last = $state('none');
</script>

{#snippet menu()}
  <ContextMenu.Trigger {disabled} class={contextTriggerClass()} data-tx-context-menu-trigger="" data-demo-part="ContextMenu.Trigger">
    <p>Fictional canvas: right-click anywhere here</p>
    <button type="button" class={buttonVariants({ variant: 'outline', size: 'sm' })}>Selected shape</button>
  </ContextMenu.Trigger>
  <ContextMenu.Content class={menuContentClass({ size, variant })} data-tx-context-menu-content="" data-size={size} data-variant={variant} data-demo-part="ContextMenu.Content">
    <ContextMenu.Item class={menuItemClass()} data-tx-menu-item="" onSelect={() => (last = 'Duplicate')}>
      <span class="tx-menu-item__label">Duplicate</span>
    </ContextMenu.Item>
    <ContextMenu.Item class={menuItemClass()} data-tx-menu-item="" data-demo-item="front" onSelect={() => (last = 'Bring to front')}>
      <span class="tx-menu-item__label">Bring to front</span>
    </ContextMenu.Item>
    <ContextMenu.Item class={menuItemClass({ disabled: true })} data-tx-menu-item="" disabled>
      <span class="tx-menu-item__label">Paste (clipboard empty)</span>
    </ContextMenu.Item>
    <ContextMenu.Separator class={menuSeparatorClass()} data-tx-menu-separator="" />
    <ContextMenu.CheckboxItem class={menuItemClass()} data-tx-menu-checkbox-item="" bind:checked={snap}>
      {#snippet children({ checked })}
        <span class={menuIndicatorClass()} data-tx-menu-indicator="" aria-hidden="true">{checked ? '✓' : ''}</span>
        <span class="tx-menu-item__label">Snap to grid</span>
      {/snippet}
    </ContextMenu.CheckboxItem>
  </ContextMenu.Content>
{/snippet}

<!-- ContextMenu.Root renders no element of its own: the marker sits on a wrapper. -->
<div data-demo-part="ContextMenu.Root">
  {#if mode === 'uncontrolled'}
    <ContextMenu.Root {loop}>
      {@render menu()}
    </ContextMenu.Root>
  {:else}
    <ContextMenu.Root {loop} bind:open>
      {@render menu()}
    </ContextMenu.Root>
  {/if}
</div>
<div class="demo-controls">
  <output data-demo-readout>{mode === 'controlled' ? `open: ${open} · ` : ''}last: {last} · snap: {snap ? 'on' : 'off'}</output>
  {#if mode === 'controlled'}
    <Button size="sm" variant="outline" onclick={() => (open = true)} data-demo-act="open">Open from outside</Button>
  {/if}
</div>
