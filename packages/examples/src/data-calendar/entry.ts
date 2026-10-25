import { defineExample } from '../registry.ts';

export const dataCalendarExample = defineExample({
  id: 'data-calendar',
  title: 'Calendar views',
  description:
    'Month, week, day and agenda views with overlapping events, explicit time zones, locale-aware dates and keyboard navigation.',
  tags: ['data', 'calendar', 'events', 'timezone', 'keyboard', 'rtl'],
  component: 'data/calendar',
  props: ['events', 'anchor', 'view', 'locale', 'timeZone', 'dir'],
  load: () => import('./CalendarDemo.svelte'),
});
