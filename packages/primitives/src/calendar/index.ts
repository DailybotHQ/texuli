import Grid from './Grid.svelte';
import Heading from './Heading.svelte';
import NextButton from './NextButton.svelte';
import PrevButton from './PrevButton.svelte';
import Root from './Root.svelte';

/** Headless, locale-aware APG calendar. */
export const Calendar: {
  Root: typeof Root;
  Heading: typeof Heading;
  PrevButton: typeof PrevButton;
  NextButton: typeof NextButton;
  Grid: typeof Grid;
} = { Root, Heading, PrevButton, NextButton, Grid };

export type { CalendarIdentifier } from '@internationalized/date';
export { CalendarDate } from '@internationalized/date';
export { Grid, Heading, NextButton, PrevButton, Root };
