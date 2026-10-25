export type DateSegment = 'month' | 'day' | 'year';

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDate(value: unknown): DateParts | null {
  if (typeof value !== 'string') return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isValidDate(parts) ? parts : null;
}

export function isValidDate({ year, month, day }: DateParts): boolean {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return Number.isInteger(day) && day >= 1 && day <= (lengths[month - 1] ?? 0);
}

export function formatDate({ year, month, day }: DateParts): string {
  if (!isValidDate({ year, month, day })) throw new RangeError('Invalid calendar date.');
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function dateSegmentOrder(locale?: string): DateSegment[] {
  const parts = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(Date.UTC(2006, 10, 22)));
  const order = parts
    .filter((part) => part.type === 'year' || part.type === 'month' || part.type === 'day')
    .map((part) => part.type as DateSegment);
  return order.length === 3 ? order : ['month', 'day', 'year'];
}

export function dateSegmentLabel(segment: DateSegment): string {
  return segment[0]?.toUpperCase() + segment.slice(1);
}

export function dateSegmentSeparator(locale: string | undefined, segment: DateSegment): string {
  const parts = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(Date.UTC(2006, 10, 22)));
  const index = parts.findIndex((part) => part.type === segment);
  if (index < 0 || index === parts.length - 1) return '';
  const next = parts[index + 1];
  return next?.type === 'literal' ? next.value : '';
}
