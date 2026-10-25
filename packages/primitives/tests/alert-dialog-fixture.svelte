<script lang="ts">
import type { FocusRestoreEvent, FocusTarget } from '@texuli/core/focus-scope';
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
} from '../src/alert-dialog/index.ts';

interface Props {
  initialFocus?: FocusTarget | (() => FocusTarget | null);
  onCloseAutoFocus?: (event: FocusRestoreEvent) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}
let { initialFocus, onCloseAutoFocus, onConfirm, onCancel }: Props = $props();
let open = $state(false);
</script>

<main>
  <Root bind:open {initialFocus} {onCloseAutoFocus}>
    <Trigger>Delete project</Trigger>
    <Portal>
      <Overlay data-alert-dialog-overlay />
      <Content>
        <Title>Delete project?</Title>
        <Description>The fictional Orbit project and its tasks will be removed.</Description>
        <Cancel
          onclick={() => {
            onCancel?.();
          }}>Cancel</Cancel
        >
        <Action
          onclick={() => {
            onConfirm?.();
          }}>Delete</Action
        >
      </Content>
    </Portal>
  </Root>
  <button type="button" data-outside-action>Outside action</button>
  <output data-open-state>{open ? 'open' : 'closed'}</output>
</main>
