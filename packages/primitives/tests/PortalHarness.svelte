<script lang="ts">
import { Portal } from '../src/portal/index.ts';

interface Props {
  to?: HTMLElement | null;
  disabled?: boolean;
  message?: string;
}

let { to = $bindable(undefined), disabled = false, message = 'Portaled content' }: Props = $props();

let frame = $state<HTMLElement | null>(null);
</script>

<section data-origin>
  <p data-before>Before</p>
  <Portal {to} {disabled}>
    <div data-portaled-content role="status">{message}</div>
  </Portal>
  <p data-after>After</p>
</section>

<aside bind:this={frame} data-custom-target aria-label="Custom target"></aside>

<button type="button" data-use-frame onclick={() => (to = frame)}>Use frame target</button>
<button type="button" data-use-body onclick={() => (to = null)}>Use body</button>
