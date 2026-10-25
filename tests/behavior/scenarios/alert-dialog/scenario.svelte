<script lang="ts">
import {
  Action,
  Cancel,
  Content,
  Description,
  Overlay,
  Portal,
  Root,
  Title,
  Trigger,
} from '@texuli/primitives/alert-dialog';
import { behaviorEvent } from '../../harness/client/events.ts';

let open = $state(false);
</script>

<Root bind:open onOpenChange={(next) => behaviorEvent('openChange', next)}>
  <Trigger>Delete project</Trigger>
  <Portal>
    <Overlay class="behavior-overlay" />
    <Content class="behavior-layer" data-behavior-layer>
      <Title>Delete project?</Title>
      <Description>The fictional Orbit project and its tasks will be removed.</Description>
      <Cancel onclick={() => behaviorEvent('cancel')}>Cancel</Cancel>
      <Action
        onclick={() => {
          behaviorEvent('confirm');
        }}>Delete</Action
      >
    </Content>
  </Portal>
</Root>

<style>
  :global(.behavior-overlay) {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
  }
  :global(.behavior-layer) {
    position: fixed;
    inset-block-start: 20%;
    inset-inline-start: 50%;
    translate: -50% 0;
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem;
    background: Canvas;
    color: CanvasText;
  }
</style>
