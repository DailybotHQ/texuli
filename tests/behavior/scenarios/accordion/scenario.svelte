<script lang="ts">
// Accordion scenario: @texuli/primitives only. Single mode, level-3
// headings, one disabled item.
import { Accordion } from '@texuli/primitives/accordion';
import { behaviorEvent } from '../../harness/client/events.ts';

const items = [
  { value: 'shipping', title: 'Shipping', body: 'Orders ship within two fictional days.' },
  { value: 'returns', title: 'Returns', body: 'Return any item within 30 days.' },
  { value: 'warranty', title: 'Warranty', body: 'Covered for a year.', disabled: true },
  { value: 'support', title: 'Support', body: 'Write to help@example.com.' },
];
let value = $state('');
</script>

<Accordion.Root type="single" bind:value onValueChange={(next) => behaviorEvent('valueChange', next)}>
  {#each items as item (item.value)}
    <Accordion.Item value={item.value} disabled={item.disabled}>
      <Accordion.Header level={3}>
        <Accordion.Trigger>{item.title}</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content><p>{item.body}</p></Accordion.Content>
    </Accordion.Item>
  {/each}
</Accordion.Root>
