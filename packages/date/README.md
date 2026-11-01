# @texuli/date

Dependency-free Gregorian calendar dates from [Texuli](https://texuli.com),
an MIT-licensed Svelte 5 component library by Dailybot, Inc. (*Small pieces.
Infinite possibilities.*). `@texuli/date` is the date arithmetic behind
Texuli's calendar, date field and date picker primitives: a `CalendarDate`
without a clock time, plus the month and week helpers a calendar grid needs.

Use it when you work with the values those primitives read and emit, or when
you need small, framework-free date-only math (add months, find the start of
a locale's week, count the weeks in a month) without a larger date library.

> **Status: 0.x release.** Texuli is in development. The packages are
> published to npm as `0.11.2`, a pre-1.0 release (1.0.0 will be the first
> stable release); `@texuli/date` was first released in `0.3.0`. Under 0.x,
> a new minor (`0.12.0`) may contain breaking changes, so pin the exact
> version or use `^0.11.0`, which accepts only 0.11.x.

## Install

```bash
npm install @texuli/date
```

```bash
pnpm add @texuli/date
# or
yarn add @texuli/date
```

No runtime dependencies, no peer dependencies and no CSS. The package is
ESM-only and ships TypeScript declarations.

## Quick start

```ts
import {
  CalendarDate,
  daysBetween,
  getLocalTimeZone,
  getWeeksInMonth,
  isSameMonth,
  localeWeekStart,
  parseDate,
  startOfMonth,
  startOfWeek,
  today,
} from '@texuli/date';

const date = parseDate('2026-03-15');          // CalendarDate 2026-03-15
date.add({ months: 1 }).toString();             // '2026-04-15'
new CalendarDate(2026, 1, 31).add({ months: 1 }).toString(); // '2026-02-28'
date.compare(parseDate('2026-03-20')) < 0;      // true

startOfMonth(date).toString();                  // '2026-03-01'
startOfWeek(date, 'en-US').toString();          // '2026-03-15' (weeks start on Sunday)
startOfWeek(date, 'en-GB').toString();          // '2026-03-09' (weeks start on Monday)
getWeeksInMonth(date, 'en-US');                 // 5
isSameMonth(date, startOfMonth(date));          // true
localeWeekStart('en-GB');                       // 1 (Monday)
daysBetween(date, parseDate('2026-03-20'));     // 5

const now = today(getLocalTimeZone());          // today's date in the user's zone
now.toDate('UTC');                              // a Date at midnight UTC
```

With the primitives, pass and receive the same type:

```svelte
<script lang="ts">
  import { parseDate } from '@texuli/date';
  import * as Calendar from '@texuli/primitives/calendar';

  let value = $state(parseDate('2026-03-15'));
</script>

<Calendar.Root bind:value locale="en-US">
  <!-- Heading, PrevButton, NextButton and Grid parts -->
</Calendar.Root>
```

`@texuli/primitives` re-exports `CalendarDate` from this package, so either
import gives the same class.

## What's inside

The root entry (`@texuli/date`) and the `@texuli/date/calendar` subpath
export the same surface:

| Export | What it does |
| --- | --- |
| `CalendarDate` | A date without a time or time zone: `year`, `month`, `day`, `add`, `subtract`, `set`, `compare`, `copy`, `toDate(timeZone)`, `toString()` (ISO `YYYY-MM-DD`) |
| `parseDate` | Parses an ISO `YYYY-MM-DD` string; throws a `RangeError` on an invalid date |
| `today`, `getLocalTimeZone` | Today's date in an IANA time zone; the runtime's zone |
| `startOfMonth`, `startOfWeek`, `getWeeksInMonth`, `isSameMonth` | Month and week helpers; weeks start on the locale's first day unless you pass one |
| `localeWeekStart`, `weekStartDay` | The locale's first day of the week as `0` (Sunday) to `6` (Saturday), Sunday when the runtime has no week info; a `weekStartsOn` number as a `DayOfWeek` (`undefined` when out of range) |
| `daysBetween` | Whole days from one `CalendarDate` to another (negative when the second is earlier) |
| `GregorianCalendar`, `createCalendar`, `toCalendar` | The calendar object a `CalendarDate` carries; `createCalendar('gregory')` is the only supported identifier |
| Types | `CalendarIdentifier` (`'gregory'`), `DateDuration`, `DateFields`, `DayOfWeek` |

## New in 0.5.0

`localeWeekStart`, `weekStartDay` and `daysBetween` ship in `0.5.0`; the
`0.4.0` release predates them.

## Key guarantees

- **No runtime dependencies.** Plain TypeScript on the standard `Date` and
  `Intl` APIs; no UI framework imports.
- **Gregorian only.** `CalendarIdentifier` is `'gregory'` and
  `createCalendar` throws for any other identifier. Other calendar systems,
  date-time arithmetic and conversion between arbitrary instants are outside
  this package.
- **Valid dates by construction.** `new CalendarDate(…)` constrains its
  fields to a real Gregorian date (month-end overflow clamps to the last
  day), and `parseDate` rejects an invalid ISO date instead of correcting it.
  Arithmetic that leaves years 1–9999 throws a `RangeError`.
- **Immutable values.** Every operation returns a new `CalendarDate`.
- **Time zones where they matter.** `today(timeZone)` reads the date in the
  zone you name, and `toDate(timeZone)` returns midnight in that zone.

## Documentation

- Website: [texuli.com](https://texuli.com)
- Calendar primitive: [prim-calendar.md](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/prim-calendar.md)
- Date picker primitive: [prim-date-picker.md](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/docs/prim-date-picker.md)
- Why Texuli owns its date math: [DECISIONS.md](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)
- Release notes and version policy: [RELEASE.md](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)

## Related packages

- [`@texuli/primitives`](https://www.npmjs.com/package/@texuli/primitives): the headless calendar, date field and date picker built on these dates.
- [`texuli`](https://www.npmjs.com/package/texuli): styled components built on the primitives.
- [`@texuli/core`](https://www.npmjs.com/package/@texuli/core): the framework-free texels the primitives use for focus, keyboard and layering.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-date).
