<script lang="ts">
import { Combobox } from '../../src/combobox/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs, variant = 'loading' }: HarnessProps = $props();
let input = $state<HTMLElement | null>(null);
const loadOptions = () =>
  variant === 'loading' ? new Promise<never>(() => {}) : Promise.reject(new Error('Offline'));

// Type once so the async load runs and the status part shows.
$effect(() => {
  if (!(input instanceof HTMLInputElement)) return;
  input.value = 'a';
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
</script>

<Combobox.Root open {loadOptions}>
  <Combobox.Input aria-label="Color" bind:ref={input} />
  <Combobox.Content aria-label="Colors">
    <Combobox.Loading {...p('combobox/Loading')} bind:ref={refs['combobox/Loading']} />
    <Combobox.Error {...p('combobox/Error')} bind:ref={refs['combobox/Error']} />
  </Combobox.Content>
</Combobox.Root>
