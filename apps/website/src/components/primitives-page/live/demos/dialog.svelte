<script lang="ts" module>
import { type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'string', name: 'title', label: 'Title text', default: 'Edit profile' },
    { kind: 'enum', name: 'size', label: 'Style size', options: ['sm', 'md', 'lg'], default: 'md' },
    { kind: 'boolean', name: 'description', label: 'Show Description', default: true },
  ],
  keys: [
    { keys: ['Enter', ' '], action: 'Open the dialog from the trigger' },
    { keys: ['Tab'], action: 'Cycle focus inside the open dialog' },
    { keys: ['Escape'], action: 'Close the dialog and return focus to the trigger' },
  ],
  uncontrolled: 'No binding: the trigger opens it and Close or Escape closes it.',
  controlled: 'bind:open keeps the state in yours, so a button outside can open it.',
  code: (v) => `<script lang="ts">
  import * as Dialog from '@texuli/primitives/dialog';
  let open = $state(false);
${SCRIPT_END}

<Dialog.Root bind:open>
  <Dialog.Trigger>Edit profile</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      <Dialog.Title>${v.title}</Dialog.Title>${
        v.description === true
          ? `
      <Dialog.Description>Changes are saved to your workspace.</Dialog.Description>`
          : ''
      }
      <label>Display name <input value="Ada Example" /></label>
      <Dialog.Close>Done</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

${recipeLine('dialogContentClass', 'texuli/dialog', { size: v.size ?? 'md' })}`,
  keyCheck: {
    open: '[data-demo-part="Trigger"]',
    focus: '[data-demo-part="Close"]',
    press: 'Escape',
    expect: { selector: '[data-demo-part="Content"]', count: 0 },
  },
  controlCheck: {
    act: '[data-demo-act="open"]',
    expect: { selector: '[data-demo-part="Content"]', count: 1 },
  },
};
</script>

<script lang="ts">
import * as Dialog from '@texuli/primitives/dialog';
import { Button, buttonVariants } from 'texuli/button';
import {
  type DialogSize,
  dialogBodyClass,
  dialogContentClass,
  dialogDescriptionClass,
  dialogFooterClass,
  dialogHeaderClass,
  dialogOverlayClass,
  dialogTitleClass,
} from 'texuli/dialog';
import { Input } from 'texuli/input';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode, portal }: DemoProps = $props();

const title = $derived(str(values, 'title', 'Edit profile') || 'Edit profile');
const size = $derived<DialogSize>(
  (['sm', 'md', 'lg'] as const).find((s) => s === str(values, 'size', 'md')) ?? 'md'
);
const showDescription = $derived(bool(values, 'description', true));
const contentClass = $derived(dialogContentClass({ size }));

let open = $state(false);
let saved = $state(0);
</script>

{#snippet content()}
  <Dialog.Portal to={portal}>
    <Dialog.Overlay class={dialogOverlayClass()} data-tx-dialog-overlay="" data-demo-part="Overlay" />
    <Dialog.Content class={contentClass} data-tx-dialog="" data-size={size} data-demo-part="Content">
      <div class={dialogHeaderClass()} data-tx-dialog-header="">
        <div class="tx-dialog__heading">
          <Dialog.Title class={dialogTitleClass()} data-demo-part="Title">{title}</Dialog.Title>
          {#if showDescription}
            <Dialog.Description class={dialogDescriptionClass()} data-demo-part="Description">
              Changes are saved to your workspace.
            </Dialog.Description>
          {/if}
        </div>
      </div>
      <div class={dialogBodyClass()} data-tx-dialog-body="">
        <label class="demo-dialog-field">
          <span>Display name</span>
          <Input name="display-name" value="Ada Example" />
        </label>
      </div>
      <div class={dialogFooterClass()} data-tx-dialog-footer="">
        <Dialog.Close class={buttonVariants({ variant: 'default', size: 'sm' })} data-demo-part="Close" onclick={() => (saved += 1)}>
          Done
        </Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
{/snippet}

{#if mode === 'uncontrolled'}
  <Dialog.Root>
    <Dialog.Trigger class={buttonVariants({ variant: 'outline', size: 'sm' })} data-demo-part="Trigger">
      Edit profile
    </Dialog.Trigger>
    {@render content()}
  </Dialog.Root>
{:else}
  <Dialog.Root bind:open>
    <Dialog.Trigger class={buttonVariants({ variant: 'outline', size: 'sm' })} data-demo-part="Trigger">
      Edit profile
    </Dialog.Trigger>
    {@render content()}
  </Dialog.Root>
  <div class="demo-controls">
    <output data-demo-readout>open: {open} · saved {saved} times</output>
    <Button size="sm" variant="secondary" onclick={() => (open = true)} data-demo-act="open">Open from outside</Button>
  </div>
{/if}

<style>
  .demo-dialog-field {
    display: grid;
    gap: 0.375rem;
    font-size: 0.875rem;
  }
</style>
