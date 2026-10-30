/**
 * Every string a dashboard announces, as templates with `{item}`,
 * `{column}`, `{row}`, `{width}`, `{height}` and `{reason}`. English
 * defaults ship; any locale overrides them through
 * {@link resolveDashboardMessages}. Values are plain text and messages
 * never carry markup.
 */
import type { DashboardItem, DashboardRefusal } from './types.ts';

export interface DashboardMessageValues {
  readonly item?: string;
  /** 1-based column. */
  readonly column?: number;
  /** 1-based row. */
  readonly row?: number;
  /** Width in columns. */
  readonly width?: number;
  /** Height in rows. */
  readonly height?: number;
  readonly reason?: string;
}

export type DashboardMessage = string | ((values: DashboardMessageValues) => string);

export interface DashboardMessages {
  /** `aria-describedby` instructions on every move handle. */
  readonly moveInstructions: DashboardMessage;
  /** `aria-describedby` instructions on every resize handle. */
  readonly resizeInstructions: DashboardMessage;
  readonly pickedUp: DashboardMessage;
  readonly moved: DashboardMessage;
  readonly dropped: DashboardMessage;
  readonly resizeStarted: DashboardMessage;
  readonly resized: DashboardMessage;
  readonly resizeDone: DashboardMessage;
  readonly cancelled: DashboardMessage;
  /** Wraps a reason: `'Cannot change {item}: {reason}.'` */
  readonly refused: DashboardMessage;
  readonly reasons: Readonly<Record<DashboardRefusal, DashboardMessage>>;
}

export const DEFAULT_DASHBOARD_MESSAGES: DashboardMessages = /* @__PURE__ */ Object.freeze({
  moveInstructions:
    'Press Space or Enter to pick up. Use the arrow keys to move one column or row, Space or Enter to drop, Escape to cancel.',
  resizeInstructions:
    'Press Space or Enter to resize. Left and right arrows change the width, up and down the height. Space or Enter to finish, Escape to cancel.',
  pickedUp: '{item} picked up. Column {column}, row {row}.',
  moved: '{item} moved to column {column}, row {row}.',
  dropped: '{item} dropped at column {column}, row {row}.',
  resizeStarted: 'Resizing {item}: {width} columns by {height} rows.',
  resized: '{item} resized to {width} columns by {height} rows.',
  resizeDone: '{item} is now {width} columns by {height} rows.',
  cancelled:
    'Change cancelled. {item} is back at column {column}, row {row}, {width} columns by {height} rows.',
  refused: 'Cannot change {item}: {reason}.',
  reasons: /* @__PURE__ */ Object.freeze({
    'unknown-item': 'the widget no longer exists',
    locked: 'a locked widget is in the way',
    edge: 'it is already at the edge',
    size: 'it is at its size limit',
  }),
});

export type DashboardMessagesOverrides = Partial<Omit<DashboardMessages, 'reasons'>> & {
  readonly reasons?: Partial<DashboardMessages['reasons']>;
};

/** Defaults merged with overrides (reasons merge key by key). */
export function resolveDashboardMessages(
  overrides: DashboardMessagesOverrides = {}
): DashboardMessages {
  return Object.freeze({
    ...DEFAULT_DASHBOARD_MESSAGES,
    ...overrides,
    reasons: Object.freeze({ ...DEFAULT_DASHBOARD_MESSAGES.reasons, ...overrides.reasons }),
  });
}

const PLACEHOLDER = /\{(item|column|row|width|height|reason)\}/g;

/** Fills a template. Missing values become empty text; the output is plain text. */
export function formatDashboardMessage(
  message: DashboardMessage,
  values: DashboardMessageValues,
  formatNumber: (value: number) => string = String
): string {
  if (typeof message === 'function') return message(values);
  return message.replace(PLACEHOLDER, (_, key: keyof DashboardMessageValues) => {
    const value = values[key];
    if (value === undefined) return '';
    return typeof value === 'number' ? formatNumber(value) : value;
  });
}

/** The 1-based position and size values of a widget, for the templates. */
export function positionValues(item: DashboardItem, label: string): DashboardMessageValues {
  return { item: label, column: item.x + 1, row: item.y + 1, width: item.w, height: item.h };
}

/** The refusal sentence for a reason. */
export function formatDashboardRefusal(
  messages: DashboardMessages,
  reason: DashboardRefusal,
  values: DashboardMessageValues,
  formatNumber?: (value: number) => string
): string {
  const text = formatDashboardMessage(messages.reasons[reason] ?? '', values, formatNumber);
  return formatDashboardMessage(messages.refused, { ...values, reason: text }, formatNumber);
}
