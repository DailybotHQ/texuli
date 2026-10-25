<script lang="ts" module>
import { type DemoSpec, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'string', name: 'title', label: 'Title', default: 'Delete the Orbit project?' },
    { kind: 'string', name: 'action', label: 'Action label', default: 'Delete' },
    { kind: 'boolean', name: 'destructive', label: 'Destructive style', default: true },
  ],
  keys: [
    { keys: ['Enter', ' '], action: 'Open from the trigger, or press the focused button' },
    { keys: ['Tab'], action: 'Cycle between Cancel and the action (focus stays inside)' },
    { keys: ['Escape'], action: 'Cancel and return focus to the trigger' },
  ],
  uncontrolled: 'The trigger opens it and Cancel or the action closes it; focus starts on Cancel.',
  controlled: 'bind:open lets your code ask for confirmation, then read the answer.',
  code: (v) => `<script lang="ts">
  import * as AlertDialog from '@texuli/primitives/alert-dialog';
  import { buttonVariants } from 'texuli/button';
  let open = $state(false);
${SCRIPT_END}

<AlertDialog.Root bind:open>
  <AlertDialog.Trigger>Delete project</AlertDialog.Trigger>
  <AlertDialog.Portal>
    <AlertDialog.Overlay />
    <AlertDialog.Content>
      <AlertDialog.Title>${v.title}</AlertDialog.Title>
      <AlertDialog.Description>Its tasks will be removed.</AlertDialog.Description>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action class={buttonVariants({ variant: '${v.destructive === true ? 'destructive' : 'default'}' })}>${v.action}</AlertDialog.Action>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>`,
  keyCheck: {
    open: '[data-demo-part="Trigger"]',
    focus: '[data-demo-part="Cancel"]',
    press: 'Escape',
    expect: { selector: '[data-demo-part="Trigger"]', attribute: 'aria-expanded', value: 'false' },
  },
  controlCheck: {
    act: '[data-demo-act="ask"]',
    expect: { selector: '[data-demo-part="Content"]', count: 1 },
  },
};
</script>

<script lang="ts">
import * as AlertDialog from '@texuli/primitives/alert-dialog';
import { Button, buttonVariants } from 'texuli/button';
import {
  alertDialogActionsClass,
  alertDialogContentClass,
  dialogDescriptionClass,
  dialogOverlayClass,
  dialogTitleClass,
} from 'texuli/dialog';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode, portal }: DemoProps = $props();

const title = $derived(str(values, 'title') || 'Delete the Orbit project?');
const action = $derived(str(values, 'action') || 'Delete');
const destructive = $derived(bool(values, 'destructive', true));

let open = $state(false);
let answer = $state('none yet');
</script>

{#snippet dialog()}
  <AlertDialog.Trigger class={buttonVariants({ variant: destructive ? 'destructive' : 'default', size: 'md' })} data-demo-part="Trigger">
    Delete project
  </AlertDialog.Trigger>
  <AlertDialog.Portal to={portal}>
    <AlertDialog.Overlay class={dialogOverlayClass()} data-tx-alert-dialog-overlay="" data-demo-part="Overlay" />
    <AlertDialog.Content class={alertDialogContentClass({ destructive })} data-tx-alert-dialog="" data-destructive={destructive ? 'true' : undefined} data-demo-part="Content">
      <div class="tx-alert-dialog__row">
        <div class="tx-alert-dialog__copy">
          <AlertDialog.Title class={dialogTitleClass()} data-demo-part="Title">{title}</AlertDialog.Title>
          <AlertDialog.Description class={dialogDescriptionClass()} data-demo-part="Description">
            The fictional Orbit project and its 12 tasks will be removed.
          </AlertDialog.Description>
        </div>
      </div>
      <div class={alertDialogActionsClass()} data-tx-alert-dialog-actions="">
        <AlertDialog.Cancel class={buttonVariants({ variant: 'outline', size: 'md' })} data-tx-alert-dialog-cancel="" data-demo-part="Cancel" onclick={() => (answer = 'cancelled')}>
          Cancel
        </AlertDialog.Cancel>
        <AlertDialog.Action class={buttonVariants({ variant: destructive ? 'destructive' : 'default', size: 'md' })} data-tx-alert-dialog-action="" data-demo-part="Action" onclick={() => (answer = 'confirmed')}>
          {action}
        </AlertDialog.Action>
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
{/snippet}

{#if mode === 'uncontrolled'}
  <AlertDialog.Root>
    {@render dialog()}
  </AlertDialog.Root>
{:else}
  <AlertDialog.Root bind:open>
    {@render dialog()}
  </AlertDialog.Root>
  <div class="demo-controls">
    <output data-demo-readout>Open: {open ? 'yes' : 'no'} · Answer: {answer}</output>
    <Button size="sm" variant="outline" onclick={() => (open = true)} data-demo-act="ask">Ask from outside</Button>
  </div>
{/if}
