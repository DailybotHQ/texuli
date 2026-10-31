import type { DatePickerLabels, DateRange } from '@texuli/primitives/date-picker';
import type { DateRangePresetLabels } from './presets.ts';

/** Every string the styled date components show or announce. Pass translations to override. */
export type DateLabels = Partial<DatePickerLabels> & {
  /** Heading of the presets list in the range picker. */
  presets?: string;
  /** Preset names. */
  presetLabels?: Partial<DateRangePresetLabels>;
};

/** What the DateRangePicker `panel` and `footer` snippets receive (G109). */
export interface DateRangePickerPanelContext {
  /** The current range (`{ start: null, end: null }` when empty). */
  readonly value: DateRange;
  /** Closes the calendar dialog (focus returns to the calendar button). */
  close: () => void;
}
