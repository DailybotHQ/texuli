import type { BuiltInRefusal, RefusalReason } from './session.ts';

/**
 * Values a message template may use, as `{item}`, `{position}` and so on.
 * Every value is plain text: messages never carry markup.
 */
export interface DragMessageValues {
  readonly item?: string;
  readonly count?: number;
  readonly position?: number;
  readonly total?: number;
  readonly container?: string;
  readonly from?: string;
  readonly reason?: string;
}

/** A template string (`'{item} moved to position {position} of {total}.'`) or a function. */
export type DragMessage = string | ((values: DragMessageValues) => string);

/** Every string a drag surface announces or labels. Localize by overriding any field. */
export interface DragMessages {
  /** `aria-roledescription` for a draggable handle. */
  readonly roleDescription: DragMessage;
  /** `aria-describedby` instructions for keyboard users. */
  readonly instructions: DragMessage;
  /** Stands in for `{item}` when several items move together. */
  readonly itemsLabel: DragMessage;
  readonly pickedUp: DragMessage;
  readonly pickedUpMany: DragMessage;
  readonly moved: DragMessage;
  readonly movedContainer: DragMessage;
  readonly dropped: DragMessage;
  readonly droppedContainer: DragMessage;
  readonly cancelled: DragMessage;
  /** Wraps a reason: `'Cannot move {item} there: {reason}.'` */
  readonly refused: DragMessage;
  /** Human text for each refusal reason; unknown reasons fall back to `other`. */
  readonly reasons: Readonly<Record<BuiltInRefusal | 'other', DragMessage>>;
}

export const DEFAULT_DRAG_MESSAGES: DragMessages = /* @__PURE__ */ Object.freeze({
  roleDescription: 'draggable item',
  instructions:
    'Press Space or Enter to pick up. Use the arrow keys to move, Space or Enter to drop, Escape to cancel.',
  itemsLabel: '{count} items',
  pickedUp: '{item} picked up. Position {position} of {total} in {container}.',
  pickedUpMany: '{count} items picked up. Position {position} of {total} in {container}.',
  moved: '{item} moved to position {position} of {total}.',
  movedContainer: '{item} moved to {container}, position {position} of {total}.',
  dropped: '{item} dropped at position {position} of {total} in {container}.',
  droppedContainer: '{item} moved from {from} to {container}, position {position} of {total}.',
  cancelled: 'Move cancelled. {item} returned to position {position} of {total} in {container}.',
  refused: 'Cannot move {item} there: {reason}.',
  reasons: /* @__PURE__ */ Object.freeze({
    cancelled: 'the move was cancelled',
    'no-target': 'there is no place to drop',
    locked: 'it is locked',
    filtered: 'it cannot be moved',
    handle: 'use its drag handle',
    disabled: 'this list is disabled',
    pull: 'items cannot leave {from}',
    put: '{container} does not accept it',
    full: '{container} is full',
    sort: '{container} cannot be reordered',
    cycle: 'an item cannot move inside itself',
    depth: 'the list would nest too deep',
    edge: 'it is already at the edge',
    'swap-multi': 'swap moves one item at a time',
    'unknown-item': 'the item no longer exists',
    other: 'the move is not allowed',
  }),
});

export interface ResolvedMessagesOptions {
  /** Formats numbers for the locale (e.g. `new Intl.NumberFormat(locale).format`). */
  readonly formatNumber?: (value: number) => string;
}

export type DragMessagesOverrides = Partial<Omit<DragMessages, 'reasons'>> & {
  readonly reasons?: Partial<DragMessages['reasons']>;
};

/** Defaults merged with overrides (reasons merge key by key). */
export function resolveDragMessages(overrides: DragMessagesOverrides = {}): DragMessages {
  return Object.freeze({
    ...DEFAULT_DRAG_MESSAGES,
    ...overrides,
    reasons: /* @__PURE__ */ Object.freeze({
      ...DEFAULT_DRAG_MESSAGES.reasons,
      ...overrides.reasons,
    }),
  });
}

const PLACEHOLDER = /\{(item|count|position|total|container|from|reason)\}/g;

/** Fills a template. Missing values become empty text; the output is plain text. */
export function formatDragMessage(
  message: DragMessage,
  values: DragMessageValues,
  options: ResolvedMessagesOptions = {}
): string {
  if (typeof message === 'function') return message(values);
  return message.replace(PLACEHOLDER, (_, key: keyof DragMessageValues) => {
    const value = values[key];
    if (value === undefined) return '';
    if (typeof value === 'number')
      return options.formatNumber ? options.formatNumber(value) : String(value);
    return value;
  });
}

/** The refusal sentence for a reason, with the reason's own text filled in. */
export function formatRefusal(
  messages: DragMessages,
  reason: RefusalReason,
  values: DragMessageValues,
  options: ResolvedMessagesOptions = {}
): string {
  const reasons = messages.reasons as Readonly<Record<string, DragMessage>>;
  const text = Object.hasOwn(reasons, reason) ? reasons[reason] : reasons.other;
  const reasonText = formatDragMessage(text ?? '', values, options);
  return formatDragMessage(messages.refused, { ...values, reason: reasonText }, options);
}
