<script lang="ts">
import { Checkbox, Radio, RadioGroup, Switch } from '../../src/components/choice/index.ts';
import { Combobox } from '../../src/components/combobox/index.ts';
import { DatePicker, DateRangePicker, TimeField } from '../../src/components/date/index.ts';
import { Field } from '../../src/components/field/index.ts';
import { FileUpload } from '../../src/components/file-upload/index.ts';
import { Input, InputGroup, Textarea, TextCounter } from '../../src/components/input/index.ts';
import { NumberField, PinInput } from '../../src/components/number-pin/index.ts';
import { Rating } from '../../src/components/rating/index.ts';
import { Select } from '../../src/components/select/index.ts';
import { Slider } from '../../src/components/slider/index.ts';
import { ColorPicker, TagsInput } from '../../src/components/tags-color/index.ts';

/** One form control inside a Field that spreads `control.props` on it. */
let { control, required = false }: { control: string; required?: boolean } = $props();
</script>

<Field label="Contact" description="Help text" error="Fix this" id="field-ctl" {required}>
  {#snippet children(c)}
    {#if control === 'Input'}
      <Input {...c.props} />
    {:else if control === 'Textarea'}
      <Textarea {...c.props} />
    {:else if control === 'TextCounter'}
      <TextCounter maxlength={20} {...c.props} />
    {:else if control === 'InputGroup'}
      <InputGroup {...c.props} />
    {:else if control === 'Checkbox'}
      <Checkbox {...c.props} />
    {:else if control === 'Switch'}
      <Switch {...c.props} />
    {:else if control === 'RadioGroup'}
      <RadioGroup {...c.props}><Radio value="a" label="A" /><Radio value="b" label="B" /></RadioGroup>
    {:else if control === 'Slider'}
      <Slider value={40} name="level" {...c.props} />
    {:else if control === 'TagsInput'}
      <TagsInput value={['a']} {...c.props} />
    {:else if control === 'ColorPicker'}
      <ColorPicker value="#3366ff" {...c.props} />
    {:else if control === 'FileUpload'}
      <FileUpload {...c.props} />
    {:else if control === 'DatePicker'}
      <DatePicker label="Contact" {...c.props} />
    {:else if control === 'DateRangePicker'}
      <DateRangePicker label="Contact" {...c.props} />
    {:else if control === 'TimeField'}
      <TimeField label="Contact" {...c.props} />
    {:else if control === 'NumberField'}
      <NumberField.Root value={5}><NumberField.Input {...c.props} /></NumberField.Root>
    {:else if control === 'PinInput'}
      <PinInput.Root maxlength={4} {...c.props} />
    {:else if control === 'Select'}
      <Select.Root value="a">
        <Select.Trigger {...c.props}><Select.Value /></Select.Trigger>
        <Select.Portal><Select.Content><Select.Viewport><Select.Item value="a" label="A">A</Select.Item></Select.Viewport></Select.Content></Select.Portal>
      </Select.Root>
    {:else if control === 'Combobox'}
      <Combobox.Root items={[{ value: 'a', label: 'A' }]}>
        <Combobox.Input {...c.props} />
      </Combobox.Root>
    {:else if control === 'Rating'}
      <Rating value={3} {...c.props} />
    {/if}
  {/snippet}
</Field>
