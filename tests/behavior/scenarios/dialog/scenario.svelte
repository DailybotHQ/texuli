<script lang="ts">
import {
  Close,
  Content,
  Description,
  Overlay,
  Portal,
  Root,
  Title,
  Trigger,
} from '@texuli/primitives/dialog';
import { behaviorEvent } from '../../harness/client/events.ts';

let open = $state(false);
let details = $state(false);
// FIX-dialog-contained-focus variants: `?variant=contained` | `mounted-open`.
const variant = new URLSearchParams(location.search).get('variant');
let containerBox = $state<HTMLElement | null>(null);
let containedOpen = $state(false);
let paletteOpen = $state(true);
</script>

{#if variant === 'contained'}
  <button type="button" onclick={() => (containedOpen = true)}>Open panel dialog</button>
  <div class="behavior-container" bind:this={containerBox} data-behavior-container>
    <p>Container content behind the dialog.</p>
    {#if containerBox}
      <Root bind:open={containedOpen} mode="contained" container={containerBox}>
        <Portal>
          <Overlay class="behavior-contained-overlay" />
          <Content class="behavior-contained-layer" data-behavior-layer>
            <Title>Panel dialog</Title>
            <label>Note <input name="note" /></label>
            <Close>Done</Close>
          </Content>
        </Portal>
      </Root>
    {/if}
  </div>
{:else if variant === 'mounted-open'}
  <Root bind:open={paletteOpen}>
    <Portal>
      <Overlay class="behavior-overlay" />
      <Content class="behavior-layer" data-behavior-layer>
        <Title>Command palette</Title>
        <input aria-label="Search commands" />
        <Close>Close</Close>
      </Content>
    </Portal>
  </Root>
{:else}

<Root bind:open onOpenChange={(next) => behaviorEvent('openChange', next)}>
  <Trigger>Open settings</Trigger>
  <Portal>
    <Overlay class="behavior-overlay" />
    <Content class="behavior-layer" data-behavior-layer>
      <Title>Settings</Title>
      <Description>Change how your fictional workspace looks.</Description>
      <label>
        Display name
        <input name="display-name" value="Ada Example" />
      </label>
      <Root bind:open={details} onOpenChange={(next) => behaviorEvent('detailsChange', next)}>
        <Trigger>Open details</Trigger>
        <Portal>
          <Overlay class="behavior-overlay behavior-overlay--top" />
          <Content class="behavior-layer behavior-layer--top">
            <Title>Details</Title>
            <Description>Workspace id: orbit-001.</Description>
            <Close>Done</Close>
          </Content>
        </Portal>
      </Root>
      <Close>Close</Close>
    </Content>
  </Portal>
</Root>
{/if}

<style>
  :global(.behavior-overlay) {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
  }
  :global(.behavior-layer) {
    position: fixed;
    inset-block-start: 15%;
    inset-inline-start: 50%;
    translate: -50% 0;
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem;
    background: Canvas;
    color: CanvasText;
  }
  :global(.behavior-container) {
    inline-size: 20rem;
    block-size: 14rem;
    margin-block: 1rem;
    border: 1px solid CanvasText;
  }
  /* No position here: the primitive fills the container with it. */
  :global(.behavior-contained-overlay) {
    background: rgb(0 0 0 / 0.4);
  }
  :global(.behavior-contained-layer) {
    position: absolute;
    inset: 1.5rem;
    display: grid;
    gap: 0.5rem;
    padding: 1rem;
    background: Canvas;
    color: CanvasText;
  }
  :global(.behavior-layer--top) {
    inset-block-start: 30%;
  }
</style>
