import { defineExample } from '../registry.ts';

/** Custom event content and month overflow (P-T-01, P-T-02, new in 0.14.1). The demo loads lazily. */
export const dataCalendarMonthExample = defineExample({
  id: 'data-calendar-month',
  title: 'Calendar month overflow and event content',
  description:
    'A busy month with custom event chip content from the event snippet, two events per day and a "more events" button that opens the day. Fictional schedule.',
  tags: ['data', 'calendar', 'events', 'month', 'snippet'],
  component: 'data/calendar',
  props: ['events', 'anchor', 'view', 'event', 'maxEventsPerDay', 'onMoreEvents'],
  load: () => import('./CalendarMonthDemo.svelte'),
});
