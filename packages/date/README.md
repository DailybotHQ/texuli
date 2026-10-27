# @texuli/date

Framework-free Gregorian date arithmetic used by Texuli's calendar and date picker. It has no runtime dependencies.

```ts
import { CalendarDate, parseDate, startOfWeek } from '@texuli/date';

const date = parseDate('2026-03-15');
const nextMonth = date.add({ months: 1 });
const weekStart = startOfWeek(date, 'en-US');
```

`CalendarDate` represents a date without a time. Construction constrains fields to valid Gregorian values; `parseDate` rejects invalid ISO dates. `today(timeZone)` uses the requested IANA time zone. `toDate(timeZone)` returns midnight in that zone. The supported year range is 1–9999.

Only the Gregorian calendar (`gregory`) is supported. The package does not implement other calendar systems, date-time arithmetic, or time-zone conversion between arbitrary instants.
