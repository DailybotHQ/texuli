<script lang="ts">
import { Board } from '@texuli/data/board';
import { Avatar } from 'texuli/avatar';
import { Button } from 'texuli/button';
import { Dialog } from 'texuli/dialog';
import { Popover } from 'texuli/popover';
import { Select } from 'texuli/select';
import { createToastStore, Toaster } from 'texuli/toast';

/*
 * The cases of tests/e2e/bugs-75-79.spec.ts (fictional data only).
 * G75 dialog-select: a Select and a Popover inside Texuli's top-layer Dialog.
 * G76 board: a 4-column board (the spec sets a 390 px viewport).
 * G77 toaster: a page Toaster and a contained one inside a framed preview.
 * G78 reveal: a hidden container with nested transitioned levels.
 * G79 avatar: a lazy avatar image (the spec adds the host [hidden] rule).
 */

let { which }: { which: string } = $props();

// G75
const rooms = [
  { value: 'harbor', label: 'Harbor room' },
  { value: 'lighthouse', label: 'Lighthouse room' },
  { value: 'dock', label: 'Dock room' },
];
let room = $state<string | undefined>(undefined);
let dialogOpen = $state(false);

// G76
const columns = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'active', title: 'In progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
];
const tasks = columns.map((column, index) => ({
  id: `task-${index}`,
  title: `Fictional task ${index + 1}`,
  column: column.id,
  rank: 'a0',
}));

// G77
const pageStore = createToastStore({ duration: 0 });
const frameStore = createToastStore({ duration: 0 });
let frame = $state<HTMLElement | null>(null);
if (typeof window !== 'undefined') {
  Object.assign(window, {
    txBugs: {
      pageToast: (title: string) => pageStore.info(title),
      frameToast: (title: string) => frameStore.info(title),
      clear: () => {
        pageStore.dismiss();
        frameStore.dismiss();
      },
    },
  });
}

// G78
let revealed = $state(false);
</script>

{#if which === 'dialog-select'}
  <section aria-labelledby="g75-title" class="case">
    <h1 id="g75-title">Book a room</h1>
    <Dialog bind:open={dialogOpen} title="Room booking" description="Pick a fictional room.">
      {#snippet trigger({ props })}
        <Button {...props}>Open booking</Button>
      {/snippet}
      <div class="field">
        <Select.Root bind:value={room} items={rooms}>
          <Select.Trigger aria-label="Room">
            <Select.Value placeholder="Choose a room" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content>
              <Select.Viewport>
                {#each rooms as item (item.value)}
                  <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
                {/each}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        <Popover.Root>
          <Popover.Trigger class="popover-trigger">Room rules</Popover.Trigger>
          <Popover.Content aria-label="Room rules">
            <p>Leave the room tidy.</p>
            <button type="button" id="rules-ack">Got it</button>
          </Popover.Content>
        </Popover.Root>
      </div>
      <output id="g75-room">{room ?? 'none'}</output>
    </Dialog>
  </section>
{:else if which === 'board'}
  <section class="case" aria-label="Board">
    <Board
      {columns}
      items={tasks}
      getId={(task) => task.id}
      getColumn={(task) => task.column}
      getRank={(task) => task.rank}
      getLabel={(task) => task.title}
      onMove={() => {}}
      labels={{ board: 'Fictional sprint board' }}
    >
      {#snippet card(task)}
        <strong>{task.title}</strong>
      {/snippet}
    </Board>
  </section>
{:else if which === 'toaster'}
  <section class="case" aria-label="Toaster">
    <h1>Framed preview</h1>
    <div class="frame" bind:this={frame} data-frame>
      <p>Preview content.</p>
    </div>
    <Toaster store={pageStore} label="Page notifications" position="top-end" />
    {#if frame}
      <Toaster
        store={frameStore}
        label="Preview notifications"
        position="bottom-end"
        mode="contained"
        container={frame}
      />
    {/if}
  </section>
{:else if which === 'reveal'}
  <section class="case" aria-label="Reveal">
    <button type="button" id="reveal-toggle" onclick={() => (revealed = !revealed)}>
      Toggle details
    </button>
    <div class="reveal" data-reveal data-open={revealed ? 'true' : 'false'}>
      <div class="level">
        <div class="level">
          <div class="level">
            <button type="button" id="deep-action">Deep action</button>
          </div>
        </div>
      </div>
    </div>
  </section>
{:else if which === 'avatar'}
  <section class="case" aria-label="Avatar">
    <Avatar name="Ada Example" src="https://avatars.example/ada.png" size="lg" />
  </section>
{/if}

<style>
  .case {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    color: var(--tx-foreground, CanvasText);
  }
  .field {
    display: grid;
    gap: 0.75rem;
    justify-items: start;
  }
  .frame {
    inline-size: 20rem;
    block-size: 15rem;
    margin-block-start: 12rem;
    margin-inline-start: 12rem;
    border: 1px solid var(--tx-border, CanvasText);
    overflow: hidden;
  }
  /* A container revealed through `visibility`, with every level transitioned. */
  .reveal,
  .level {
    transition: all 300ms ease 50ms;
  }
  .reveal {
    visibility: hidden;
    opacity: 0;
  }
  .reveal[data-open='true'] {
    visibility: visible;
    opacity: 1;
  }
  .level {
    padding: 0.25rem;
  }
</style>
