<script lang="ts">
import { createToastManager, Toast, type ToastRecord } from '../src/toast/index.ts';

let {
  duration = 5000,
}: {
  duration?: number;
} = $props();

const manager = createToastManager();
let toasts = $state<readonly ToastRecord[]>([]);

$effect(() =>
  manager.subscribe((next) => {
    toasts = next;
  })
);

function publish(): void {
  manager.publish({
    title: 'File saved',
    description: 'Undo is available.',
    duration,
    priority: 'normal',
    tone: 'background',
  });
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
          <Toast.Action>Undo</Toast.Action>
          <Toast.Close />
        </Toast.Root>
      {/each}
    </ol>
  </Toast.Viewport>
</Toast.Provider>
