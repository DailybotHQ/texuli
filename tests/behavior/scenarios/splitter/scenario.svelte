<script lang="ts">
// Splitter scenario: @texuli/primitives' Splitter, held to the WAI-ARIA APG
// window splitter pattern.
import { Splitter } from '@texuli/primitives/splitter';
import { behaviorEvent } from '../../harness/client/events.ts';

const storage = typeof localStorage === 'undefined' ? undefined : localStorage;
</script>

<div class="frame">
  <Splitter.Root
    direction="horizontal"
    autoSaveId="behavior-splitter"
    {storage}
    onLayoutChange={(layout) => behaviorEvent('layout', layout)}
    class="group"
    data-testid="mail"
  >
    <Splitter.Pane
      id="nav-pane"
      defaultSize={30}
      minSize={20}
      maxSize={60}
      collapsible
      onCollapse={() => behaviorEvent('collapse')}
      onExpand={() => behaviorEvent('expand')}
      class="pane"
    >
      <a href="#inbox">Inbox</a>
    </Splitter.Pane>
    <Splitter.Handle label="Resize navigation" class="handle" />
    <Splitter.Pane id="main-pane" minSize={30} class="pane">
      <p>Fictional message list</p>
    </Splitter.Pane>
  </Splitter.Root>

  <Splitter.Root direction="vertical" class="group group--tall">
    <Splitter.Pane id="editor-pane" defaultSize={60} minSize={20} class="pane"><p>Editor</p></Splitter.Pane>
    <Splitter.Handle label="Resize terminal" class="handle" />
    <Splitter.Pane id="terminal-pane" minSize={20} class="pane"><p>Terminal</p></Splitter.Pane>
  </Splitter.Root>

  <div dir="rtl" lang="ar">
    <Splitter.Root direction="horizontal" class="group">
      <Splitter.Pane id="rtl-side" defaultSize={30} minSize={10} class="pane"><p>القائمة</p></Splitter.Pane>
      <Splitter.Handle label="تغيير حجم القائمة" class="handle" />
      <Splitter.Pane id="rtl-main" class="pane"><p>المحتوى</p></Splitter.Pane>
    </Splitter.Root>
  </div>
</div>

<style>
  .frame {
    display: grid;
    gap: 1rem;
    inline-size: 40rem;
    max-inline-size: 100%;
  }
  :global(.group) {
    block-size: 6rem;
    border: 1px solid CanvasText;
  }
  :global(.group--tall) {
    block-size: 12rem;
  }
  /* Padding goes inside the pane: a collapsed pane keeps its own padding and border. */
  :global(.pane) > :global(*) {
    margin: 0;
    padding: 0.5rem;
  }
  :global(.handle) {
    flex: 0 0 0.75rem;
    background: color-mix(in srgb, CanvasText 25%, Canvas);
  }
  :global(.handle:focus-visible) {
    outline: 2px solid Highlight;
    outline-offset: 2px;
  }
</style>
