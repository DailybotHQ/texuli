<script lang="ts">
import * as D from '../../src/dialog/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<D.Root open>
  <D.Trigger {...p('dialog/Trigger')} bind:ref={refs['dialog/Trigger']}>Open</D.Trigger>
  <D.Portal>
    <D.Overlay {...p('dialog/Overlay')} bind:ref={refs['dialog/Overlay']} />
    <D.Content {...p('dialog/Content')} bind:ref={refs['dialog/Content']}>
      <D.Title {...p('dialog/Title')} bind:ref={refs['dialog/Title']}>Title</D.Title>
      <D.Description {...p('dialog/Description')} bind:ref={refs['dialog/Description']}>Text</D.Description>
      <D.Close {...p('dialog/Close')} bind:ref={refs['dialog/Close']}>Close</D.Close>
    </D.Content>
  </D.Portal>
</D.Root>
