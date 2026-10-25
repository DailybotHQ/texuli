<script lang="ts">
import { Splitter } from '../../../src/splitter/index.ts';
</script>

<Splitter.Root direction="horizontal">
  <Splitter.Pane id="nav-pane" defaultSize={40}>Navigation</Splitter.Pane>
  <Splitter.Handle aria-label="Resize navigation" />
  <Splitter.Pane id="main-pane" defaultSize={60}>Main</Splitter.Pane>
</Splitter.Root>
