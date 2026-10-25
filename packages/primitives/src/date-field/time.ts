export type TimeSegment = 'hour' | 'minute' | 'dayPeriod';

export interface TimeParts {
  hour: number;
  minute: number;
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTime(value: unknown): TimeParts | null {
  if (typeof value !== 'string') return null;
  const match = TIME.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

export function formatTime(parts: TimeParts): string {
  if (
    !Number.isInteger(parts.hour) ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    !Number.isInteger(parts.minute) ||
    parts.minute < 0 ||
    parts.minute > 59
  )
    throw new RangeError('Invalid time.');
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function timeSegmentOrder(locale?: string, hourCycle?: 12 | 24): TimeSegment[] {
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    ...(hourCycle === 12
      ? { hourCycle: 'h12' as const }
      : hourCycle === 24
        ? { hourCycle: 'h23' as const }
        : {}),
  };
  const parts = new Intl.DateTimeFormat(locale, options).formatToParts(
    new Date(Date.UTC(2006, 0, 1, 17, 5))
  );
  const order: TimeSegment[] = [];
  for (const part of parts) {
    if (part.type === 'hour' && !order.includes('hour')) order.push('hour');
    if (part.type === 'minute' && !order.includes('minute')) order.push('minute');
    if (part.type === 'dayPeriod' && !order.includes('dayPeriod')) order.push('dayPeriod');
  }
  return order.includes('hour') && order.includes('minute') ? order : ['hour', 'minute'];
}

export function formatHour(hour: number, hourCycle: 12 | 24): number {
  if (hourCycle === 24) return hour;
  return hour % 12 || 12;
}

export function parseHour(displayHour: number, period: 'AM' | 'PM', hourCycle: 12 | 24): number {
  if (hourCycle === 24) return displayHour;
  return (displayHour % 12) + (period === 'PM' ? 12 : 0);
}

export function dayPeriod(hour: number): 'AM' | 'PM' {
  return hour < 12 ? 'AM' : 'PM';
}
