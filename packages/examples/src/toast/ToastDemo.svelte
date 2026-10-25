<script lang="ts">
import { Button } from 'texuli/button';
import { createToastStore, Toaster } from 'texuli/toast';

const store = createToastStore({ duration: 0 });

function showAll(): void {
  store.success('Profile saved', { description: 'Harbor workspace updated.' });
  store.info('Sync queued', { description: 'Will run when online.' });
  store.warning('Storage nearly full', { description: 'Free up space soon.' });
  store.error('Could not send invite', {
    description: 'Check the fictional email address.',
    action: {
      label: 'Retry',
      onClick: () => {
        store.info('Retrying…', { duration: 0 });
      },
    },
  });
}

function showPromise(): void {
  const work = new Promise<string>((resolve) => {
    setTimeout(() => resolve('ok'), 800);
  });
  store.promise(work, {
    loading: 'Publishing draft…',
    success: 'Draft published',
    error: 'Publish failed',
  });
}
</script>

<section data-example="texuli-toast" aria-labelledby="toast-demo-title">
  <h2 id="toast-demo-title">Toaster</h2>
  <p>Styled toasts with tones, actions, and promise updates. Announcements use the shared announcer.</p>

  <div class="actions">
    <Button type="button" onclick={showAll}>Show all tones</Button>
    <Button type="button" variant="secondary" onclick={showPromise}>Promise toast</Button>
    <Button type="button" variant="outline" onclick={() => store.dismiss()}>Dismiss all</Button>
  </div>

  <div dir="rtl" class="rtl-note">
    <p>RTL sample: toasts still pin to the logical end edge.</p>
    <Button type="button" size="sm" onclick={() => store.info('رسالة تجريبية', { description: 'RTL description' })}
      >RTL toast</Button
    >
  </div>

  <Toaster {store} label="Notifications" />
</section>

<style>
  section {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    min-block-size: 12rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .rtl-note {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px dashed var(--tx-border, currentColor);
    border-radius: var(--tx-radius-md, 0.375rem);
  }
  p {
    margin: 0;
  }
</style>
