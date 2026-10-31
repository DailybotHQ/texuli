/**
 * @texuli/forms/controls: the static control registry (G119). SchemaForm
 * loads the controls of date, time, datetime, slider, tags, file, color and
 * radio fields on first use, so a form that never paints them never ships
 * them, and the step navigation of multi-step forms likewise. A host that renders forms on the server passes this registry as
 * `controls`, so every control renders on the server and hydrates at once:
 *
 *   <SchemaForm form={form} controls={SCHEMA_FORM_CONTROLS} />
 */
import ColorControl from './ColorControl.svelte';
import DateControl from './DateControl.svelte';
import DateTimeControl from './DateTimeControl.svelte';
import FileControl from './FileControl.svelte';
import ProgressControl from './ProgressControl.svelte';
import RadioControl from './RadioControl.svelte';
import SliderControl from './SliderControl.svelte';
import TagsControl from './TagsControl.svelte';
import TimeControl from './TimeControl.svelte';
import type { SchemaFormControls } from './types.ts';

export const SCHEMA_FORM_CONTROLS: SchemaFormControls = Object.freeze({
  date: DateControl,
  time: TimeControl,
  datetime: DateTimeControl,
  slider: SliderControl,
  tags: TagsControl,
  file: FileControl,
  color: ColorControl,
  radio: RadioControl,
  progress: ProgressControl,
});

export {
  isLazyControlType,
  LAZY_CONTROL_TYPES,
  type LazyControlType,
  type SchemaFormControl,
  type SchemaFormControlProps,
  type SchemaFormControls,
  type SchemaFormProgressProps,
} from './types.ts';
export {
  ColorControl,
  DateControl,
  DateTimeControl,
  FileControl,
  ProgressControl,
  RadioControl,
  SliderControl,
  TagsControl,
  TimeControl,
};
