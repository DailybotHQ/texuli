<script lang="ts">
import * as D from '../../src/alert-dialog/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<D.Root open>
  <D.Trigger {...p('alert-dialog/Trigger')} bind:ref={refs['alert-dialog/Trigger']}>Open</D.Trigger>
  <D.Portal>
    <D.Overlay {...p('alert-dialog/Overlay')} bind:ref={refs['alert-dialog/Overlay']} />
    <D.Content {...p('alert-dialog/Content')} bind:ref={refs['alert-dialog/Content']}>
      <D.Title {...p('alert-dialog/Title')} bind:ref={refs['alert-dialog/Title']}>Title</D.Title>
      <D.Description {...p('alert-dialog/Description')} bind:ref={refs['alert-dialog/Description']}>Text</D.Description>
      <D.Cancel {...p('alert-dialog/Cancel')} bind:ref={refs['alert-dialog/Cancel']}>Cancel</D.Cancel>
      <D.Action {...p('alert-dialog/Action')} bind:ref={refs['alert-dialog/Action']}>OK</D.Action>
    </D.Content>
  </D.Portal>
</D.Root>
