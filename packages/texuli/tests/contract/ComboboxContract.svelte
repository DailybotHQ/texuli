<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { MultiSelect } from '../../src/components/combobox/index.ts';

let { p, refs, variant = 'list' }: HarnessProps = $props();
const k = (name: string) => `components/combobox/${name}`;
const items = $derived(
  variant === 'empty'
    ? []
    : [
        { value: 'amber', label: 'Amber' },
        { value: 'blue', label: 'Blue' },
      ]
);
let input = $state<HTMLElement | null>(null);
const loadOptions = $derived(
  variant === 'loading'
    ? () => new Promise<never>(() => {})
    : variant === 'error'
      ? () => Promise.reject(new Error('Offline'))
      : undefined
);
$effect(() => {
  if (!loadOptions || !(input instanceof HTMLInputElement)) return;
  input.value = 'a';
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
</script>

<MultiSelect.Root open value={['amber']} {items} {loadOptions}>
  <MultiSelect.Field {...p(k('ComboboxField'))} bind:ref={refs[k('ComboboxField')]}>
    <MultiSelect.Chips {...p(k('ComboboxChips'))} bind:ref={refs[k('ComboboxChips')]}>
      <MultiSelect.Chip value="amber" {...p(k('ComboboxChip'))} bind:ref={refs[k('ComboboxChip')]} />
    </MultiSelect.Chips>
    {#if loadOptions}
      <MultiSelect.Input aria-label="Color" bind:ref={input} />
    {:else}
      <MultiSelect.Input aria-label="Color" {...p(k('ComboboxInput'))} bind:ref={refs[k('ComboboxInput')]} />
    {/if}
    <MultiSelect.Trigger aria-label="Show colors" {...p(k('ComboboxTrigger'))} bind:ref={refs[k('ComboboxTrigger')]} />
  </MultiSelect.Field>
  <MultiSelect.Portal>
    <MultiSelect.Content aria-label="Colors" {...p(k('ComboboxContent'))} bind:ref={refs[k('ComboboxContent')]}>
      <MultiSelect.Loading {...p(k('ComboboxLoading'))} bind:ref={refs[k('ComboboxLoading')]} />
      <MultiSelect.Empty {...p(k('ComboboxEmpty'))} bind:ref={refs[k('ComboboxEmpty')]} />
      <MultiSelect.Error {...p(k('ComboboxError'))} bind:ref={refs[k('ComboboxError')]} />
      <MultiSelect.Viewport {...p(k('ComboboxViewport'))} bind:ref={refs[k('ComboboxViewport')]}>
        {#snippet children(item)}
          {#if item.value === 'blue'}
            <MultiSelect.Item value={item.value} label={item.label} {...p(k('ComboboxItem'))} bind:ref={refs[k('ComboboxItem')]}>{item.label}</MultiSelect.Item>
          {:else}
            <MultiSelect.Item value={item.value} label={item.label}>{item.label}</MultiSelect.Item>
          {/if}
        {/snippet}
      </MultiSelect.Viewport>
    </MultiSelect.Content>
  </MultiSelect.Portal>
</MultiSelect.Root>
