<script lang="ts">
import * as AlertDialog from '../src/alert-dialog/index.ts';
import * as Dialog from '../src/dialog/index.ts';
import { Portal } from '../src/portal/index.ts';

interface Props {
  /** Opt out of scope following (`scope={null}`): the pre-ADR-023 body portal. */
  optOut?: boolean;
}
let { optOut = false }: Props = $props();
let scopeEl = $state<HTMLElement>();
</script>

<section
  bind:this={scopeEl}
  data-scope-a
  data-tx-scope=""
  data-tx-theme="ocean"
  data-tx-mode="dark"
  style="--tx-background: rgb(1, 2, 3)"
>
  <Portal scope={optOut ? null : 'auto'}>
    <p data-generic-portaled>Generic</p>
  </Portal>
  <Dialog.Root open={true}>
    <Dialog.Portal scope={optOut ? null : 'auto'}>
      <Dialog.Content aria-label="Scoped dialog">
        <Dialog.Title>Scoped dialog</Dialog.Title>
        <button type="button">Inside</button>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
  <AlertDialog.Root open={true}>
    <AlertDialog.Portal scope={optOut ? null : 'auto'}>
      <AlertDialog.Content>
        <AlertDialog.Title>Scoped alert</AlertDialog.Title>
        <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>
</section>

<button type="button" data-toggle-mode onclick={() => scopeEl?.setAttribute('data-tx-mode', 'light')}>
  Light
</button>
