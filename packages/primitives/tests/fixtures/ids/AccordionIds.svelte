<script lang="ts">
import { Accordion } from '../../../src/accordion/index.ts';
</script>

<Accordion.Root type="single" value="shipping">
  <Accordion.Item value="shipping">
    <Accordion.Header level={3}>
      <Accordion.Trigger id="shipping-trigger">Shipping</Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Content id="shipping-panel">Ships in two days.</Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
