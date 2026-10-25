import Content from './Content.svelte';
import DatePickerCalendar from './DatePickerCalendar.svelte';
import DatePickerField from './DatePickerField.svelte';
import DatePickerRoot from './DatePickerRoot.svelte';
import DateRangePickerCalendar from './DateRangePickerCalendar.svelte';
import DateRangePickerField from './DateRangePickerField.svelte';
import DateRangePickerRoot from './DateRangePickerRoot.svelte';
import RangeGrid from './RangeGrid.svelte';
import Trigger from './Trigger.svelte';

/** APG date picker dialog: a DateField, a button and a calendar in a modal dialog. */
export const DatePicker: {
  Root: typeof DatePickerRoot;
  Field: typeof DatePickerField;
  Trigger: typeof Trigger;
  Content: typeof Content;
  Calendar: typeof DatePickerCalendar;
} = {
  Root: DatePickerRoot,
  Field: DatePickerField,
  Trigger,
  Content,
  Calendar: DatePickerCalendar,
};

/** The same pattern for a range: start and end fields, and a range calendar. */
export const DateRangePicker: {
  Root: typeof DateRangePickerRoot;
  Field: typeof DateRangePickerField;
  Trigger: typeof Trigger;
  Content: typeof Content;
  Calendar: typeof DateRangePickerCalendar;
  Grid: typeof RangeGrid;
} = {
  Root: DateRangePickerRoot,
  Field: DateRangePickerField,
  Trigger,
  Content,
  Calendar: DateRangePickerCalendar,
  Grid: RangeGrid,
};

export {
  type DatePickerLabels,
  DEFAULT_DATE_PICKER_LABELS,
  inRange,
  orderedRange,
  resolveDatePickerLabels,
  toCalendarDate,
} from './shared.ts';
export type { DateRange } from './types.ts';
