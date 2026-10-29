<script lang="ts">
import { Combobox } from '../../src/combobox/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs, variant = 'list' }: HarnessProps = $props();
const items = $derived(
  variant === 'empty'
    ? []
    : [
        { value: 'amber', label: 'Amber' },
        { value: 'blue', label: 'Blue' },
      ]
);
</script>

<Combobox.Root open multiple value={['amber']} {items}>
  <Combobox.Chips {...p('combobox/Chips')} bind:ref={refs['combobox/Chips']}>
    <Combobox.Chip value="amber" {...p('combobox/Chip')} bind:ref={refs['combobox/Chip']} />
    <Combobox.ChipRemove value="amber" {...p('combobox/ChipRemove')} bind:ref={refs['combobox/ChipRemove']}>×</Combobox.ChipRemove>
  </Combobox.Chips>
  <Combobox.Input aria-label="Color" {...p('combobox/Input')} bind:ref={refs['combobox/Input']} />
  <Combobox.Trigger aria-label="Show colors" {...p('combobox/Trigger')} bind:ref={refs['combobox/Trigger']}>▾</Combobox.Trigger>
  <Combobox.Portal>
    <Combobox.Content aria-label="Colors" {...p('combobox/Content')} bind:ref={refs['combobox/Content']}>
      <Combobox.Empty {...p('combobox/Empty')} bind:ref={refs['combobox/Empty']} />
      <Combobox.Viewport {...p('combobox/Viewport')} bind:ref={refs['combobox/Viewport']}>
        {#snippet children(item)}
          {#if item.value === 'blue'}
            <Combobox.Item value={item.value} label={item.label} {...p('combobox/Item')} bind:ref={refs['combobox/Item']}>{item.label}</Combobox.Item>
          {:else}
            <Combobox.Item value={item.value} label={item.label}>{item.label}</Combobox.Item>
          {/if}
        {/snippet}
      </Combobox.Viewport>
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>
