import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './feedback.css';

export const FEEDBACK_TONES = [
  'primary',
  'success',
  'warning',
  'destructive',
  'info',
  'neutral',
] as const;
export type FeedbackTone = (typeof FEEDBACK_TONES)[number];

export const FEEDBACK_SIZES = ['sm', 'md', 'lg'] as const;
export type FeedbackSize = (typeof FEEDBACK_SIZES)[number];

export const PROGRESS_SHAPES = ['linear', 'circular'] as const;
export type ProgressShape = (typeof PROGRESS_SHAPES)[number];

export const skeletonClass = variants({
  base: 'tx-skeleton',
  variants: {
    size: {
      sm: 'tx-skeleton--sm',
      md: 'tx-skeleton--md',
      lg: 'tx-skeleton--lg',
    },
  },
  defaultVariants: { size: 'md' },
});

export const spinnerClass = variants({
  base: 'tx-spinner',
  variants: {
    size: {
      sm: 'tx-spinner--sm',
      md: 'tx-spinner--md',
      lg: 'tx-spinner--lg',
    },
    tone: {
      primary: 'tx-spinner--primary',
      success: 'tx-spinner--success',
      warning: 'tx-spinner--warning',
      destructive: 'tx-spinner--destructive',
      info: 'tx-spinner--info',
      neutral: 'tx-spinner--neutral',
    },
  },
  defaultVariants: { size: 'md', tone: 'primary' },
});

export const progressClass = variants({
  base: 'tx-progress',
  variants: {
    size: {
      sm: 'tx-progress--sm',
      md: 'tx-progress--md',
      lg: 'tx-progress--lg',
    },
    tone: {
      primary: 'tx-progress--primary',
      success: 'tx-progress--success',
      warning: 'tx-progress--warning',
      destructive: 'tx-progress--destructive',
      info: 'tx-progress--info',
      neutral: 'tx-progress--neutral',
    },
    shape: {
      linear: 'tx-progress--linear',
      circular: 'tx-progress--circular',
    },
  },
  defaultVariants: { size: 'md', tone: 'primary', shape: 'linear' },
});
