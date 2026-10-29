import type { Snippet } from 'svelte';
import type { HTMLAttributes, HTMLInputAttributes } from 'svelte/elements';

export type DateFieldRootProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value?: string | null;
  locale?: string;
  label?: string;
  /** Id of the first segment, so a `<label for>` (or a Field) focuses it. */
  inputId?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  onValueChange?: (value: string | null) => void;
  /**
   * Called once when complete typed text (month, day and a four-digit year)
   * is not a real date (`invalid`) or falls outside `min`/`max`
   * (`out-of-range`). `text` is the segments in locale order (`2/30/2026`).
   */
  onInvalid?: (text: string, reason: 'invalid' | 'out-of-range') => void;
  children?: Snippet;
};

/** Translatable names of the time segments. */
export interface TimeFieldLabels {
  hour: string;
  minute: string;
  dayPeriod: string;
}

export type TimeFieldRootProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value?: string | null;
  locale?: string;
  label?: string;
  /** Id of the first segment, so a `<label for>` (or a Field) focuses it. */
  inputId?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  hourCycle?: 12 | 24;
  /** Minutes moved by ArrowUp/ArrowDown on the minute segment (1–60; default 1). */
  minuteStep?: number;
  labels?: Partial<TimeFieldLabels>;
  onValueChange?: (value: string | null) => void;
  children?: Snippet;
};

export type DateSegmentInputProps = Omit<HTMLInputAttributes, 'type' | 'value' | 'min' | 'max'>;
