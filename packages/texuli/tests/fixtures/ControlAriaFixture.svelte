<script lang="ts">
// FIX-choice-aria: each styled form control rendered without a visible label
// and named only by aria-label (plus an aria-describedby), as a data table's
// "Select row" checkbox is.
import { Checkbox, Radio, Switch } from '../../src/components/choice/index.ts';
import RadioGroup from '../../src/components/choice/RadioGroup.svelte';
import { Combobox } from '../../src/components/combobox/index.ts';
import { FileUpload } from '../../src/components/file-upload/index.ts';
import { Input, Textarea } from '../../src/components/input/index.ts';
import { NumberField, PinInput } from '../../src/components/number-pin/index.ts';
import { Rating } from '../../src/components/rating/index.ts';
import { Select } from '../../src/components/select/index.ts';
import { Slider } from '../../src/components/slider/index.ts';
import { TagsInput } from '../../src/components/tags-color/index.ts';
import { Toggle, ToggleGroup, ToggleGroupItem } from '../../src/components/toggle/index.ts';

let { which }: { which: string } = $props();
const NAME = 'Probe label';
const DESC = 'probe-desc';
</script>

<p id={DESC}>Probe description</p>
{#if which === 'checkbox'}
  <Checkbox aria-label={NAME} aria-describedby={DESC} data-probe="control" />
{:else if which === 'checkbox-labeled'}
  <Checkbox label="Visible" aria-describedby={DESC} data-probe="control" />
{:else if which === 'switch'}
  <Switch aria-label={NAME} aria-describedby={DESC} data-probe="control" />
{:else if which === 'radio-group'}
  <RadioGroup aria-label={NAME} aria-describedby={DESC} items={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />
{:else if which === 'radio'}
  <RadioGroup aria-label="Group">
    <Radio value="a" aria-label={NAME} aria-describedby={DESC} data-probe="control" />
  </RadioGroup>
{:else if which === 'input'}
  <Input aria-label={NAME} aria-describedby={DESC} data-probe="control" />
{:else if which === 'textarea'}
  <Textarea aria-label={NAME} aria-describedby={DESC} data-probe="control" />
{:else if which === 'select-trigger'}
  <Select.Root items={[{ value: 'a', label: 'A' }]}>
    <Select.Trigger aria-label={NAME} aria-describedby={DESC} data-probe="control">
      <Select.Value placeholder="Pick" />
    </Select.Trigger>
  </Select.Root>
{:else if which === 'combobox-input'}
  <Combobox.Root items={[{ value: 'a', label: 'A' }]}>
    <Combobox.Field>
      <Combobox.Input aria-label={NAME} aria-describedby={DESC} data-probe="control" />
    </Combobox.Field>
  </Combobox.Root>
{:else if which === 'slider'}
  <Slider aria-label={NAME} aria-describedby={DESC} data-probe="control" value={20} />
{:else if which === 'number-field'}
  <NumberField.Root defaultValue={1}>
    <NumberField.Input aria-label={NAME} aria-describedby={DESC} data-probe="control" />
  </NumberField.Root>
{:else if which === 'pin-input'}
  <PinInput.Root aria-label={NAME} aria-describedby={DESC} data-probe="control" />
{:else if which === 'tags-input'}
  <TagsInput aria-label={NAME} aria-describedby={DESC} data-probe="control" />
{:else if which === 'file-upload'}
  <FileUpload aria-label={NAME} aria-describedby={DESC} data-probe="control" />
{:else if which === 'toggle'}
  <Toggle aria-label={NAME} aria-describedby={DESC} data-probe="control">B</Toggle>
{:else if which === 'toggle-group-item'}
  <ToggleGroup aria-label="Format">
    <ToggleGroupItem value="b" aria-label={NAME} aria-describedby={DESC} data-probe="control">B</ToggleGroupItem>
  </ToggleGroup>
{:else if which === 'rating'}
  <Rating aria-label={NAME} aria-describedby={DESC} data-probe="control" value={3} />
{/if}
