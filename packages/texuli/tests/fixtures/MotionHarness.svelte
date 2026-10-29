<script lang="ts">
import { AlertDialog, Dialog } from '../../src/components/dialog/index.ts';
import { DropdownMenu } from '../../src/components/menus/index.ts';
import { HoverCard, Popover } from '../../src/components/popover/index.ts';
import { Sheet } from '../../src/components/sheet/index.ts';
import { Accordion, Tabs } from '../../src/components/tabs-accordion/index.ts';
import { Toaster } from '../../src/components/toast/index.ts';
import type { ToastStore } from '../../src/components/toast/toast-store.ts';
import { Tooltip } from '../../src/components/tooltip/index.ts';
import type { MotionLevel, MotionProp } from '../../src/motion/contract.ts';
import MotionProvider from '../../src/motion/MotionProvider.svelte';

export type MotionHarnessKind =
  | 'dialog'
  | 'alert-dialog'
  | 'sheet'
  | 'popover'
  | 'hover-card'
  | 'menu'
  | 'tooltip'
  | 'tabs'
  | 'accordion'
  | 'toaster';

let {
  kind,
  open = $bindable(false),
  value = $bindable(''),
  level = 'full',
  reducedMotion,
  motion,
  store,
}: {
  kind: MotionHarnessKind;
  open?: boolean;
  value?: string;
  level?: MotionLevel;
  reducedMotion?: boolean;
  motion?: MotionProp;
  store?: ToastStore;
} = $props();

const tabs = [
  { value: 'overview', label: 'Overview' },
  { value: 'activity', label: 'Activity' },
  { value: 'settings', label: 'Settings' },
];
const sections = [
  { value: 'shipping', title: 'Shipping', content: 'Ships in two days.' },
  { value: 'returns', title: 'Returns', content: 'Free returns for 30 days.' },
];
</script>

<MotionProvider {level} {reducedMotion}>
  <button type="button" data-probe="outside">Outside</button>
  {#if kind === 'dialog'}
    <Dialog bind:open title="Edit crew" {motion} data-probe="panel">
      {#snippet trigger({ props })}<button type="button" {...props}>Open</button>{/snippet}
      <p>Crew roster.</p>
    </Dialog>
  {:else if kind === 'alert-dialog'}
    <AlertDialog bind:open title="Delete project?" {motion} data-probe="panel">
      {#snippet trigger({ props })}<button type="button" {...props}>Open</button>{/snippet}
    </AlertDialog>
  {:else if kind === 'sheet'}
    <Sheet.Root bind:open>
      <Sheet.Trigger>Open</Sheet.Trigger>
      <Sheet.Portal>
        <Sheet.Overlay {motion} />
        <Sheet.Content {motion} data-probe="panel">
          <Sheet.Title>Filters</Sheet.Title>
          <Sheet.Close>Apply</Sheet.Close>
        </Sheet.Content>
      </Sheet.Portal>
    </Sheet.Root>
  {:else if kind === 'popover'}
    <Popover.Root bind:open>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Content aria-label="Share" {motion} data-probe="panel">
        <button type="button">Copy link</button>
      </Popover.Content>
    </Popover.Root>
  {:else if kind === 'hover-card'}
    <HoverCard.Root bind:open openDelay={0} closeDelay={0}>
      <HoverCard.Trigger>Open</HoverCard.Trigger>
      <HoverCard.Content aria-label="Jordan Lee" {motion} data-probe="panel">
        <p>Mathematician · example.com</p>
      </HoverCard.Content>
    </HoverCard.Root>
  {:else if kind === 'menu'}
    <DropdownMenu.Root bind:open>
      <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
      <DropdownMenu.Content {motion} data-probe="panel">
        <DropdownMenu.Item>New file</DropdownMenu.Item>
        <DropdownMenu.Item>Rename</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {:else if kind === 'tooltip'}
    <Tooltip content="Saves without publishing" bind:open {motion} data-probe="panel">
      {#snippet children({ props })}<button type="button" {...props}>Open</button>{/snippet}
    </Tooltip>
  {:else if kind === 'tabs'}
    <Tabs items={tabs} bind:value label="Project" {motion} />
  {:else if kind === 'accordion'}
    <Accordion items={sections} bind:value {motion} />
  {:else if kind === 'toaster' && store}
    <Toaster {store} label="Notifications" {motion} />
  {/if}
</MotionProvider>
