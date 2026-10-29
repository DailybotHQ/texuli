<script lang="ts">
import { Checkbox } from '../../src/checkbox/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Checkbox.Group {...p('checkbox/CheckboxGroup')} bind:ref={refs['checkbox/CheckboxGroup']} aria-label="Options">
  <Checkbox.Root aria-label="Accept" defaultChecked {...p('checkbox/CheckboxRoot')} bind:ref={refs['checkbox/CheckboxRoot']}>
    <Checkbox.Indicator {...p('checkbox/CheckboxIndicator')} bind:ref={refs['checkbox/CheckboxIndicator']} />
  </Checkbox.Root>
</Checkbox.Group>
