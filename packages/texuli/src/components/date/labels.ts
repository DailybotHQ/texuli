import type { DatePickerLabels } from '@texuli/primitives/date-picker';
import type { DateRangePresetLabels } from './presets.ts';

/** Every string the styled date components show or announce. Pass translations to override. */
export type DateLabels = Partial<DatePickerLabels> & {
  /** Heading of the presets list in the range picker. */
  presets?: string;
  /** Preset names. */
  presetLabels?: Partial<DateRangePresetLabels>;
};
