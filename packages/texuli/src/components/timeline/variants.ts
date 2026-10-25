import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './timeline.css';

export const TIMELINE_ORIENTATIONS = ['vertical', 'horizontal'] as const;
export type TimelineOrientation = (typeof TIMELINE_ORIENTATIONS)[number];

/** Marker tones. Never the only signal: status has a shape and a spoken word. */
export const TIMELINE_TONES = [
  'default',
  'success',
  'warning',
  'destructive',
  'info',
  'neutral',
] as const;
export type TimelineTone = (typeof TIMELINE_TONES)[number];

/** Where an item stands: done, happening now, or still to come. */
export const TIMELINE_STATUSES = ['complete', 'current', 'upcoming'] as const;
export type TimelineStatus = (typeof TIMELINE_STATUSES)[number];

export const timelineClass = variants({
  base: 'tx-timeline',
  variants: {
    orientation: {
      vertical: 'tx-timeline--vertical',
      horizontal: 'tx-timeline--horizontal',
    },
  },
  defaultVariants: { orientation: 'vertical' },
});

export const timelineItemClass = variants({
  base: 'tx-timeline__item',
  variants: {
    tone: {
      default: 'tx-timeline__item--default',
      success: 'tx-timeline__item--success',
      warning: 'tx-timeline__item--warning',
      destructive: 'tx-timeline__item--destructive',
      info: 'tx-timeline__item--info',
      neutral: 'tx-timeline__item--neutral',
    },
  },
  defaultVariants: { tone: 'default' },
});
