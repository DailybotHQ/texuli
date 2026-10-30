<script lang="ts">
import { createToastManager, Toast, type ToastRecord } from '@texuli/primitives/toast';
import { behaviorEvent } from '../../harness/client/events.ts';

const manager = createToastManager({ duration: 0 });
// Contained regions (G99): one frame left static, one declared positioned.
const framedManager = createToastManager({ duration: 0 });
let staticFrame = $state<HTMLElement | null>(null);
let positionedFrame = $state<HTMLElement | null>(null);
let toasts = $state<readonly ToastRecord[]>(manager.list());

$effect(() =>
  manager.subscribe((next) => {
    toasts = next;
    behaviorEvent('toastCount', next.length);
  })
);

function publish(): void {
  manager.publish({
    title: 'File saved',
    description: 'Undo is available.',
    duration: 0,
    tone: 'background',
  });
  behaviorEvent('publish', true);
}
</script>

<Toast.Provider {manager} label="Notifications">
  <button type="button" onclick={publish}>Publish toast</button>
  <Toast.Viewport>
    <ol>
      {#each toasts as toast (toast.id)}
        <Toast.Root {toast}>
          <Toast.Title />
          <Toast.Description />
          <Toast.Action
            onclick={() => {
              behaviorEvent('action', toast.id);
            }}>Undo</Toast.Action
          >
          <Toast.Close />
        </Toast.Root>
      {/each}
    </ol>
  </Toast.Viewport>
</Toast.Provider>

<div data-testid="static-frame" bind:this={staticFrame}></div>
<div data-testid="positioned-frame" style="position: absolute" bind:this={positionedFrame}></div>
<Toast.Provider manager={framedManager} label="Framed alerts" hotkey="F7">
  <Toast.Viewport mode="contained" container={staticFrame} data-testid="static-region"></Toast.Viewport>
</Toast.Provider>
<Toast.Provider manager={framedManager} label="Pinned alerts" hotkey="F8">
  <Toast.Viewport mode="contained" container={positionedFrame} positioned data-testid="positioned-region"></Toast.Viewport>
</Toast.Provider>
