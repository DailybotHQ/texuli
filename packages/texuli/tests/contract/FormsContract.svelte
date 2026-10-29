<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { Checkbox, Radio, RadioGroup, Switch } from '../../src/components/choice/index.ts';
import {
  Calendar,
  DatePicker,
  DateRangePicker,
  TimeField,
} from '../../src/components/date/index.ts';
import { Description, Field, FieldError, Form, Label } from '../../src/components/field/index.ts';
import { FileUpload } from '../../src/components/file-upload/index.ts';
import { Input, InputGroup, Textarea, TextCounter } from '../../src/components/input/index.ts';
import { Slider } from '../../src/components/slider/index.ts';
import { ColorPicker, TagsInput } from '../../src/components/tags-color/index.ts';

let { p, refs }: HarnessProps = $props();
const k = (name: string) => `components/${name}`;
</script>

<Form {...p(k('field/Form'))} bind:ref={refs[k('field/Form')]}>
  <Label for="contract-x" {...p(k('field/Label'))} bind:ref={refs[k('field/Label')]}>Name</Label>
  <Input aria-label="Name" value="Ada" {...p(k('input/Input'))} bind:ref={refs[k('input/Input')]} />
  <Description {...p(k('field/Description'))} bind:ref={refs[k('field/Description')]}>Help</Description>
  <FieldError show {...p(k('field/FieldError'))} bind:ref={refs[k('field/FieldError')]}>Required</FieldError>
  <Textarea aria-label="Notes" value="Hi" {...p(k('input/Textarea'))} bind:ref={refs[k('input/Textarea')]} />
  <TextCounter label="Bio" maxlength={20} value="Hi" {...p(k('input/TextCounter'))} bind:ref={refs[k('input/TextCounter')]} />
  <InputGroup aria-label="Amount" value="5" {...p(k('input/InputGroup'))} bind:ref={refs[k('input/InputGroup')]} />
  <Checkbox label="Accept" {...p(k('choice/Checkbox'))} bind:ref={refs[k('choice/Checkbox')]} />
  <Switch label="Notify" {...p(k('choice/Switch'))} bind:ref={refs[k('choice/Switch')]} />
  <RadioGroup value="a" aria-label="Plan" {...p(k('choice/RadioGroup'))} bind:ref={refs[k('choice/RadioGroup')]}>
    <Radio value="a" label="A" />
    <Radio value="b" label="B" {...p(k('choice/Radio'))} bind:ref={refs[k('choice/Radio')]} />
  </RadioGroup>
  <Slider value={40} label="Volume" {...p(k('slider/Slider'))} bind:ref={refs[k('slider/Slider')]} />
  <TagsInput value={['a']} label="Tags" {...p(k('tags-color/TagsInput'))} bind:ref={refs[k('tags-color/TagsInput')]} />
  <ColorPicker value="#3366ff" {...p(k('tags-color/ColorPicker'))} bind:ref={refs[k('tags-color/ColorPicker')]} />
  <FileUpload {...p(k('file-upload/FileUpload'))} bind:ref={refs[k('file-upload/FileUpload')]} />
  <Calendar value="2026-03-10" today="2026-03-10" label="Day" {...p(k('date/Calendar'))} bind:ref={refs[k('date/Calendar')]} />
  <DatePicker label="Due" value="2026-03-10" {...p(k('date/DatePicker'))} bind:ref={refs[k('date/DatePicker')]} />
  <DateRangePicker label="Stay" {...p(k('date/DateRangePicker'))} bind:ref={refs[k('date/DateRangePicker')]} />
  <TimeField label="At" value="09:30" {...p(k('date/TimeField'))} bind:ref={refs[k('date/TimeField')]} />
  <Field label="Email" {...p(k('field/Field'))} bind:ref={refs[k('field/Field')]}>
    {#snippet children(control)}<Input {...control.props} />{/snippet}
  </Field>
</Form>
