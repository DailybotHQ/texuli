<script lang="ts">
import { createToastManager, Toast, type ToastRecord } from '@texuli/primitives/toast';
import { behaviorEvent } from '../../harness/client/events.ts';

const manager = createToastManager({ duration: 0 });
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
