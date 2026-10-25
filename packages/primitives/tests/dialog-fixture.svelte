<script lang="ts">
import type { FocusRestoreEvent, FocusTarget } from '@texuli/core/focus-scope';
import {
  Close,
  Content,
  Description,
  Overlay,
  Portal,
  Root,
  Title,
  Trigger,
} from '../src/dialog/index.ts';

interface Props {
  contained?: boolean;
  initialFocus?: FocusTarget | (() => FocusTarget | null);
  onCloseAutoFocus?: (event: FocusRestoreEvent) => void;
}
let { contained = false, initialFocus, onCloseAutoFocus }: Props = $props();
let open = $state(false);
let details = $state(false);
let frame = $state<HTMLElement>();
let preferredFocus = $state<HTMLElement>();
</script>

<main>
  <section bind:this={frame} data-dialog-frame>
    <Root
      bind:open
      mode={contained ? 'contained' : 'top-layer'}
      container={contained ? frame ?? null : null}
      initialFocus={initialFocus ?? (() => preferredFocus ?? null)}
      {onCloseAutoFocus}
    >
      <Trigger>Open settings</Trigger>
      <Portal>
        <Overlay data-dialog-overlay />
        <Content aria-label={undefined}>
          <Title>Settings</Title>
          <Description>Change how your fictional workspace looks.</Description>
          <label>
            Display name
            <input name="display-name" value="Ada Example" />
          </label>
          <button type="button" bind:this={preferredFocus}>Preferred focus</button>
          <Root bind:open={details}>
            <Trigger>Open details</Trigger>
            <Portal>
              <Overlay data-dialog-overlay />
              <Content>
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
    <button type="button" data-frame-action>Frame action</button>
  </section>
  <button type="button" data-outside-action>Outside action</button>
  <output data-open-state>{open ? 'open' : 'closed'}</output>
</main>
