<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { Select } from '../../src/components/select/index.ts';

let { p, refs }: HarnessProps = $props();
const k = (name: string) => `components/select/${name}`;
</script>

<Select.Root value="a" open>
  <Select.Trigger aria-label="Plan" {...p(k('SelectTrigger'))} bind:ref={refs[k('SelectTrigger')]}><Select.Value /></Select.Trigger>
  <Select.Portal>
    <Select.Content {...p(k('SelectContent'))} bind:ref={refs[k('SelectContent')]}>
      <Select.Viewport {...p(k('SelectViewport'))} bind:ref={refs[k('SelectViewport')]}>
        <Select.Group {...p(k('SelectGroup'))} bind:ref={refs[k('SelectGroup')]}>
          <Select.Label {...p(k('SelectLabel'))} bind:ref={refs[k('SelectLabel')]}>Plans</Select.Label>
          <Select.Item value="a" label="Basic">Basic</Select.Item>
          <Select.Item value="b" label="Pro" {...p(k('SelectItem'))} bind:ref={refs[k('SelectItem')]}>Pro</Select.Item>
        </Select.Group>
        <Select.Separator {...p(k('SelectSeparator'))} bind:ref={refs[k('SelectSeparator')]} />
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
