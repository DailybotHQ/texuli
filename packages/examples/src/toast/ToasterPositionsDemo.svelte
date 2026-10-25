<script lang="ts">
import { Button } from 'texuli/button';
import { Dialog } from 'texuli/dialog';
import { createToastStore, Toaster } from 'texuli/toast';

/*
 * Two stacks on one page: success and info at the top end, warning and
 * error at the bottom start (the controls sit clear of both). Every toast stays until dismissed, so the capture
 * shows two of each tone in place.
 */
const top = createToastStore({ duration: 0 });
const bottom = createToastStore({ duration: 0 });

function fill(): void {
  top.dismiss();
  bottom.dismiss();
  top.success('Profile saved', { description: 'Harbor workspace updated.' });
  top.success('Invite accepted', { description: 'Rowan joined the crew.' });
  top.info('Sync queued', { description: 'Runs when the boat is online.' });
  top.info('New release notes', { description: 'Read what changed this week.' });
  bottom.warning('Storage nearly full', { description: 'Free up space soon.' });
  bottom.warning('Session ends soon', { description: 'Save your fictional draft.' });
  bottom.error('Could not send invite', {
    description: 'Check the fictional email address.',
    action: {
      label: 'Retry',
      onClick: () => {
        bottom.info('Retrying the invite');
      },
    },
  });
  bottom.error('Upload failed', { description: 'manifest.pdf is over 10 MB.' });
}

$effect(() => {
  fill();
});
</script>

<section data-example="texuli-toaster-positions" aria-labelledby="toaster-positions-title">
  <h2 id="toaster-positions-title">Toaster positions</h2>
  <p>
    Two toasters: success and info at the top end, warning and error at the bottom start. Start and
    end follow the reading direction; narrow screens center both stacks.
  </p>
  <div class="actions">
    <Button type="button" onclick={fill}>Show every tone again</Button>
    <Button
      type="button"
      variant="outline"
      onclick={() => {
        top.dismiss();
        bottom.dismiss();
      }}>Dismiss all</Button
    >
    <!-- The toast region stays reachable under a modal (F6, or a pointer). -->
    <Dialog title="Edit crew roster" description="The toasts stay operable while this is open.">
      {#snippet trigger({ props })}
        <Button {...props} variant="secondary">Open a dialog</Button>
      {/snippet}
      <p>Press F6 to reach the notifications, then come back with Shift+Tab or Escape.</p>
    </Dialog>
  </div>

  <Toaster store={top} position="top-end" label="Account notifications" />
  <Toaster store={bottom} position="bottom-start" label="System notifications" />
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
  h2,
  p {
    margin: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
