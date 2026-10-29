<script lang="ts">
import { Splitter } from '../../src/splitter/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Splitter.Root {...p('splitter/Root')} bind:ref={refs['splitter/Root']}>
  <Splitter.Pane id="nav" defaultSize={30} minSize={20} {...p('splitter/Pane')} bind:ref={refs['splitter/Pane']}>Nav</Splitter.Pane>
  <Splitter.Handle label="Resize" {...p('splitter/Handle')} bind:ref={refs['splitter/Handle']} />
  <Splitter.Pane id="main">Main</Splitter.Pane>
</Splitter.Root>
