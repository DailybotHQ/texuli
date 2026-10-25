<script lang="ts" module>
import { type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'kind',
      label: 'Style',
      options: ['info', 'success', 'warning', 'error'],
      default: 'success',
    },
    {
      kind: 'enum',
      name: 'tone',
      label: 'tone',
      options: ['background', 'foreground'],
      default: 'background',
    },
    {
      kind: 'number',
      name: 'duration',
      label: 'duration (s, 0 stays)',
      min: 0,
      max: 10,
      step: 1,
      default: 5,
    },
    { kind: 'boolean', name: 'action', label: 'With an action', default: true },
  ],
  keys: [
    { keys: ['F6'], action: 'Jump into the notifications (uncontrolled panel)' },
    { keys: ['F8'], action: 'Jump into the notifications (controlled panel, hotkey="F8")' },
    { keys: ['Tab'], action: 'Reach the action and the close button; focus pauses the timer' },
  ],
  uncontrolled: 'Toast.Toaster subscribes to the manager and renders the queue; you only publish.',
  controlled:
    'You subscribe to the manager and render each Toast.Root yourself, so code outside can dismiss them.',
  code: (v) => `<script lang="ts">
  import { createToastManager, Toast } from '@texuli/primitives/toast';
  const manager = createToastManager();
  let toasts = $state(manager.list());
  $effect(() => manager.subscribe((next) => (toasts = next)));
${SCRIPT_END}

<button onclick={() => manager.publish({ title: 'Report saved', description: 'Sent to team@example.com.', duration: ${Number(v.duration) * 1000}, tone: '${v.tone}' })}>
  Save
</button>
<Toast.Provider {manager}>
  <Toast.Viewport class="tx-toaster__viewport" data-position="top-end">
    <ol>
      {#each toasts as toast (toast.id)}
        <Toast.Root {toast}>
          <Toast.Title />
          <Toast.Description />${
            v.action
              ? `
          <Toast.Action altText="Undo the save">Undo</Toast.Action>`
              : ''
          }
          <Toast.Close aria-label="Dismiss">×</Toast.Close>
        </Toast.Root>
      {/each}
    </ol>
  </Toast.Viewport>
</Toast.Provider>
${recipeLine('toastItemClass', 'texuli/toast', { kind: String(v.kind) })}`,
  keyCheck: {
    open: '[data-demo-act="show"]',
    focus: '[data-demo-act="show"]',
    press: 'F6',
    expect: { selector: '[data-tx-toast-viewport] :focus', count: 1 },
  },
  controlCheck: {
    act: '[data-demo-act="show"]',
    expect: { selector: '[data-demo-part="Toast.Root"]', count: 1 },
  },
};
</script>

<script lang="ts">
import { createToastManager, Toast, type ToastRecord } from '@texuli/primitives/toast';
import { Button } from 'texuli/button';
import { toastItemClass } from 'texuli/toast';
import { bool, type DemoProps, num, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

type Kind = 'info' | 'success' | 'warning' | 'error';
const MARK: Record<Kind, string> = { success: '✓', error: '!', info: 'i', warning: '!' };

const kind = $derived<Kind>(
  (['info', 'success', 'warning', 'error'] as const).find((entry) => entry === str(values, 'kind')) ?? 'success'
);
const tone = $derived(str(values, 'tone') === 'foreground' ? 'foreground' : 'background');
const duration = $derived(num(values, 'duration', 5) * 1000);
const withAction = $derived(bool(values, 'action', true));
const itemClass = $derived(toastItemClass({ kind }));

const manager = createToastManager();
let toasts = $state<readonly ToastRecord[]>(manager.list());
let saved = 0;

$effect(() =>
  manager.subscribe((next) => {
    toasts = next;
  })
);

function publish(): void {
  saved += 1;
  manager.publish({
    title: `Report ${saved} saved`,
    description: 'A copy went to team@example.com.',
    duration,
    tone,
  });
}
</script>

{#snippet item(toast: ToastRecord)}
  <Toast.Root {toast} class={itemClass} data-kind={kind} data-demo-part="Toast.Root">
    <span class="tx-toast__icon" aria-hidden="true">{MARK[kind]}</span>
    <div class="tx-toast__body">
      <Toast.Title class="tx-toast__title" data-demo-part="Toast.Title" />
      <Toast.Description class="tx-toast__description" data-demo-part="Toast.Description" />
      {#if withAction}
        <Toast.Action class="tx-toast__action" altText="Undo the save" data-demo-part="Toast.Action">Undo</Toast.Action>
      {/if}
    </div>
    <Toast.Close class="tx-toast__close" aria-label="Dismiss: {toast.title}" data-demo-part="Toast.Close">
      <span aria-hidden="true">×</span>
    </Toast.Close>
  </Toast.Root>
{/snippet}

<div class="demo-controls">
  <Button size="sm" onclick={publish} data-demo-act="show">Save a report</Button>
  {#if mode === 'controlled'}
    <Button size="sm" variant="outline" onclick={() => manager.dismissAll()} data-demo-act="dismiss">Dismiss all</Button>
    <output data-demo-readout>Queued toasts: {toasts.length}</output>
  {/if}
</div>

{#if mode === 'uncontrolled'}
  <div class="demo-toasts" data-demo-part="Toast.Toaster" data-mode="uncontrolled">
    <Toast.Toaster
      {manager}
      label="Notifications (uncontrolled demo)"
      toast={item}
      class="tx-toaster__viewport"
      data-position="bottom-end"
    />
  </div>
{:else}
  <Toast.Provider {manager} label="Notifications (controlled demo)" hotkey="F8">
    <div class="demo-toasts" data-mode="controlled">
      <Toast.Viewport class="tx-toaster__viewport" data-position="top-end" data-demo-part="Toast.Viewport">
        <ol class="tx-toaster__list" data-tx-toast-list>
          {#each toasts as toast (toast.id)}
            {@render item(toast)}
          {/each}
        </ol>
      </Toast.Viewport>
    </div>
  </Toast.Provider>
{/if}

