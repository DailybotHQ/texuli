<script lang="ts">
import { Select } from '../../src/select/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Select.Root type="single" value="a" open>
  <Select.Trigger aria-label="Plan" {...p('select/Trigger')} bind:ref={refs['select/Trigger']}><Select.Value /></Select.Trigger>
  <Select.Portal>
    <Select.Content {...p('select/Content')} bind:ref={refs['select/Content']}>
      <Select.Viewport {...p('select/Viewport')} bind:ref={refs['select/Viewport']}>
        <Select.Group {...p('select/Group')} bind:ref={refs['select/Group']}>
          <Select.GroupLabel {...p('select/GroupLabel')} bind:ref={refs['select/GroupLabel']}>Plans</Select.GroupLabel>
          <Select.Item value="a" label="Basic">Basic</Select.Item>
          <Select.Item value="b" label="Pro" {...p('select/Item')} bind:ref={refs['select/Item']}>Pro</Select.Item>
        </Select.Group>
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
