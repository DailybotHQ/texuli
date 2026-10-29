<script lang="ts">
import { Accordion } from '../../src/accordion/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Accordion.Root type="single" collapsible {...p('accordion/AccordionRoot')} bind:ref={refs['accordion/AccordionRoot']}>
  <Accordion.Item value="a" {...p('accordion/AccordionItem')} bind:ref={refs['accordion/AccordionItem']}>
    <Accordion.Header {...p('accordion/AccordionHeader')} bind:ref={refs['accordion/AccordionHeader']}>
      <Accordion.Trigger {...p('accordion/AccordionTrigger')} bind:ref={refs['accordion/AccordionTrigger']}>A</Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Content forceMount {...p('accordion/AccordionContent')} bind:ref={refs['accordion/AccordionContent']}>Body</Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
