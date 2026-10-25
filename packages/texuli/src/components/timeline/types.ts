import type { HrefTrust } from '@texuli/core/url-policy';
import type { TimelineStatus, TimelineTone } from './variants.ts';

/** One entry of a data-driven `<Timeline items={…}>`. */
export interface TimelineItemData {
  /** Stable key for the list (defaults to the index). */
  id?: string;
  /** Visible time label, e.g. "Mar 4" or "Week 2". */
  time?: string;
  /** Machine-readable date or duration for `<time datetime>`, e.g. "2026-03-04". */
  datetime?: string;
  title: string;
  description?: string;
  /** Turns the title into a link; it passes the URL policy first. */
  href?: string;
  tone?: TimelineTone;
  status?: TimelineStatus;
}

/** Translatable words the timeline speaks. */
export interface TimelineMessages {
  /** The list's accessible name when no `label` is given. */
  label: string;
  complete: string;
  current: string;
  upcoming: string;
}

export const DEFAULT_TIMELINE_MESSAGES: Readonly<TimelineMessages> = Object.freeze({
  label: 'Timeline',
  complete: 'Completed',
  current: 'Current',
  upcoming: 'Upcoming',
});

/** What a `<Timeline>` shares with the items inside it. */
export interface TimelineContext {
  messages: TimelineMessages;
  hrefTrust: HrefTrust;
}

export const TIMELINE_CONTEXT = Symbol('texuli.timeline');
