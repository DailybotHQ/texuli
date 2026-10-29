<script lang="ts">
import type { TagsInputInvalidDetail } from '@texuli/primitives/tags-input';
import { TagsInput } from '../../src/components/tags-color/index.ts';

interface Props {
  value?: string[];
  max?: number;
  validate?: (tag: string, tags: readonly string[]) => boolean | string;
  onInvalid?: (detail: TagsInputInvalidDetail) => void;
  onInputValueChange?: (value: string) => void;
}

let { value = ['design'], max, validate, onInvalid, onInputValueChange }: Props = $props();
let draft = $state('');
</script>

<TagsInput
  bind:value
  bind:inputValue={draft}
  {max}
  {validate}
  {onInvalid}
  {onInputValueChange}
  label="Recipients"
  inputLabel="Add a recipient"
/>
<output data-probe="draft">{draft}</output>
<button type="button" onclick={() => (draft = 'ops@example.com')}>Prefill</button>
