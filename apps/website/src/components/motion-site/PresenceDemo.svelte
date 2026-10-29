<script lang="ts">
/**
 * /motion-page/ presence: a Dialog, a Sheet and a contained Toaster, all
 * animating through `texuli/motion` under one MotionProvider that follows
 * the page settings. The presets are the closed spec names.
 */
import { Button } from 'texuli/button';
import { Dialog } from 'texuli/dialog';
import {
  MOTION_DURATION_NAMES,
  MOTION_PRESETS,
  type MotionDurationName,
  type MotionPreset,
  MotionProvider,
} from 'texuli/motion';
import { Sheet } from 'texuli/sheet';
import { createToastStore, Toaster } from 'texuli/toast';
import SettingsNote from './SettingsNote.svelte';
import { MOTION_SETTINGS, providerReduced } from './settings.svelte.ts';

let enter = $state<MotionPreset>('scale');
let exit = $state<MotionPreset>('fade');
let duration = $state<MotionDurationName>('base');
let dialogOpen = $state(false);
let stage = $state<HTMLElement | null>(null);

const toasts = createToastStore();
const MESSAGES = [
  ['Deploy finished', 'harbor-notes.example.com is live.'],
  ['Invite sent', 'ana@example.com can join the workspace.'],
  ['Report ready', 'The week 44 summary is in your inbox.'],
] as const;
let next = 0;

function showToast(): void {
  const [title, description] = MESSAGES[next % MESSAGES.length] ?? MESSAGES[0];
  next += 1;
  toasts.success(title, { description, duration: 6000 });
}

const motion = $derived({ enter, exit, duration });
</script>

<MotionProvider level={MOTION_SETTINGS.level} reducedMotion={providerReduced()}>
  <div class="presence" data-motion-presence="">
    <fieldset class="presence__options">
      <legend class="sr-only">Presence options</legend>
      <label>
        <span>Enter</span>
        <select bind:value={enter} data-motion-enter="">
          {#each MOTION_PRESETS as preset (preset)}
            <option value={preset}>{preset}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Exit</span>
        <select bind:value={exit}>
          {#each MOTION_PRESETS as preset (preset)}
            <option value={preset}>{preset}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Duration</span>
        <select bind:value={duration}>
          {#each MOTION_DURATION_NAMES as step (step)}
            <option value={step}>{step}</option>
          {/each}
        </select>
      </label>
    </fieldset>

    <pre class="presence__code"><code
        >motion={`{{ enter: '${enter}', exit: '${exit}', duration: '${duration}' }}`}</code
      ></pre>

    <div class="presence__stage" bind:this={stage}>
      <div class="presence__actions">
        <Dialog
          bind:open={dialogOpen}
          title="Edit the release crew"
          description="Fictional crew for the Harbor Notes launch."
          {motion}
          data-motion-dialog=""
        >
          {#snippet trigger({ props })}
            <Button {...props}>Open dialog</Button>
          {/snippet}
          <p>Ana, Lee and Sam review the release notes on Thursday.</p>
          {#snippet footer()}
            <Button variant="outline" onclick={() => (dialogOpen = false)}>Cancel</Button>
            <Button onclick={() => (dialogOpen = false)}>Save crew</Button>
          {/snippet}
        </Dialog>

        <Sheet.Root>
          <Sheet.Trigger>
            {#snippet child({ props })}
              <Button variant="outline" {...props}>Open sheet</Button>
            {/snippet}
          </Sheet.Trigger>
          <Sheet.Portal>
            <Sheet.Overlay />
            <Sheet.Content side="end" size="sm" motion={{ duration }} data-motion-sheet="">
              <Sheet.Header
                title="Filters"
                description="A sheet slides from the edge it is attached to."
              />
              <Sheet.Body>
                <p>Status: open. Owner: anyone. Updated: this week.</p>
              </Sheet.Body>
              <Sheet.Footer>
                <Sheet.Close>
                  {#snippet child({ props })}
                    <Button {...props}>Apply filters</Button>
                  {/snippet}
                </Sheet.Close>
              </Sheet.Footer>
            </Sheet.Content>
          </Sheet.Portal>
        </Sheet.Root>

        <Button variant="secondary" onclick={showToast}>Show toast</Button>
      </div>
      {#if stage}
        <Toaster
          store={toasts}
          mode="contained"
          container={stage}
          label="Demo notifications"
          motion={{ duration }}
        />
      {/if}
    </div>

    <SettingsNote name="presence" />
  </div>
</MotionProvider>

<style>
  .presence {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.9rem;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .presence__options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .presence__options label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .presence__options select {
    min-block-size: 2.25rem;
    min-inline-size: 8rem;
    padding-inline: 0.5rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.5rem;
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
    font: inherit;
    font-weight: 400;
  }
  .presence__code {
    margin: 0;
    padding: 0.6rem 0.75rem;
    overflow-x: auto;
    border-radius: 0.6rem;
    background: var(--tx-muted, Canvas);
    font-size: 0.8125rem;
  }
  .presence__stage {
    position: relative;
    display: grid;
    align-content: start;
    min-block-size: 13rem;
    padding: 1rem;
    overflow: hidden;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.75rem;
  }
  .presence__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
