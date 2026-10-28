import DateFieldRoot from './DateField.svelte';
import TimeFieldRoot from './TimeField.svelte';

export const DateField = { Root: DateFieldRoot };
export const TimeField = { Root: TimeFieldRoot };
export {
  type DateParts,
  type DateSegment,
  dateSegmentLabel,
  dateSegmentOrder,
  dateSegmentSeparator,
  formatDate,
  isValidDate,
  parseDate,
} from './date.ts';
export {
  dayPeriod,
  formatHour,
  formatTime,
  parseHour,
  parseTime,
  type TimeParts,
  type TimeSegment,
  timeSegmentOrder,
} from './time.ts';
export type {
  DateFieldRootProps,
  DateSegmentInputProps,
  TimeFieldLabels,
  TimeFieldRootProps,
} from './types.ts';
