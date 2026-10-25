import type { Snippet } from 'svelte';
import type { HTMLAttributes, HTMLInputAttributes } from 'svelte/elements';

export type DateFieldRootProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value?: string | null;
  locale?: string;
  label?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  onValueChange?: (value: string | null) => void;
  children?: Snippet;
};

export type TimeFieldRootProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value?: string | null;
  locale?: string;
  label?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  hourCycle?: 12 | 24;
  minuteStep?: number;
  onValueChange?: (value: string | null) => void;
  children?: Snippet;
};

export type DateSegmentInputProps = Omit<HTMLInputAttributes, 'type' | 'value' | 'min' | 'max'>;
