/**
 * The closed action set of spec 0.3.0, as pure reducers. A node's `on`
 * maps an event to 1–8 actions; they run in order against a working copy of
 * the state, and the whole list commits or none of it does. Nothing is
 * evaluated: every action is data from a closed vocabulary, and every value
 * is coerced to its variable's declaration.
 */
import { ACTION_NAME } from '../actions.ts';
import {
  coerceStateValue,
  type ListItem,
  MAX_LIST_ITEMS,
  type StateDeclarations,
  type StateSnapshot,
  type StateValue,
} from './schema.ts';

/** What the node reports with an event (a change's value, a move's item and target). */
export interface EventDetail {
  value?: unknown;
}

export type ActionEffect =
  | { kind: 'flow'; event: string }
  | { kind: 'emit'; intent: string; values: Readonly<Record<string, string | number | boolean>> }
  | { kind: 'submit' };

export type ActionsResult =
  | {
      ok: true;
      snapshot: StateSnapshot;
      changed: readonly string[];
      effects: readonly ActionEffect[];
    }
  | { ok: false; reason: string };

/** Most values an `emit` carries, and the longest string value (spec `SPEC_LIMITS`). */
export const MAX_EMIT_VALUES = 32;
export const MAX_EMIT_VALUE_LENGTH = 2048;

type Bag = Record<string, unknown>;
const isBag = (value: unknown): value is Bag =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface MoveOptions {
  /** Item ids that may not leave the source list. */
  locked?: readonly string[];
  /** `move` (default), `clone` (a copy with a fresh id) or `none` (nothing leaves). */
  pull?: 'move' | 'clone' | 'none';
}

export type MoveResult =
  | { ok: true; lists: Readonly<Record<string, readonly ListItem[]>> }
  | { ok: false; reason: string };

/**
 * The normative `moveItem` reducer: refuse (no change) when the item is not
 * in `from` or is locked there; otherwise remove it and insert it into `to`
 * (default `from`) at `clamp(index ?? length, 0, length)`, refusing when the
 * target would pass `maxItems`. With `pull: "clone"`, the source keeps the
 * item and the target gets a copy whose id is `<id>-<n>` (the smallest
 * `n ≥ 2` not in use); refused when that id would pass 64 characters.
 */
export function moveListItem(
  lists: Readonly<Record<string, readonly ListItem[]>>,
  maxItems: Readonly<Record<string, number>>,
  move: { from: string; item: string; to?: string; index?: number },
  options: MoveOptions = {}
): MoveResult {
  const fromList = lists[move.from];
  const toName = move.to ?? move.from;
  const toList = lists[toName];
  if (!fromList || !toList) return { ok: false, reason: 'unknown-list' };
  const at = fromList.findIndex((item) => item.id === move.item);
  if (at === -1) return { ok: false, reason: 'unknown-item' };
  if (options.locked?.includes(move.item)) return { ok: false, reason: 'locked' };
  const pull = options.pull ?? 'move';
  if (pull === 'none' && toName !== move.from) return { ok: false, reason: 'pull' };
  const item = fromList[at] as ListItem;
  const clone = pull === 'clone' && toName !== move.from;
  const source = clone ? fromList : fromList.filter((_, i) => i !== at);
  const target = toName === move.from ? source : toList;
  if (toName !== move.from && target.length + 1 > (maxItems[toName] ?? MAX_LIST_ITEMS)) {
    return { ok: false, reason: 'full' };
  }
  let placed = item;
  if (clone) {
    const used = new Set([...fromList, ...toList].map((entry) => entry.id));
    let n = 2;
    while (used.has(`${item.id}-${n}`)) n += 1;
    const id = `${item.id}-${n}`;
    if (id.length > 64) return { ok: false, reason: 'clone-id' };
    placed = Object.freeze({ ...item, id }) as ListItem;
  }
  const index = Math.min(Math.max(0, Math.trunc(move.index ?? target.length)), target.length);
  const next = [...target];
  next.splice(index, 0, placed);
  const out: Record<string, readonly ListItem[]> = { ...lists, [toName]: Object.freeze(next) };
  if (toName !== move.from) out[move.from] = Object.freeze([...source]);
  return { ok: true, lists: out };
}

/**
 * Run one event's actions against `snapshot`. Writes go only to declared,
 * writable variables (`source`-less) and must fit them; a refused action
 * refuses the whole list.
 */
export function runActions(
  actions: readonly unknown[],
  context: {
    snapshot: StateSnapshot;
    declarations: StateDeclarations;
    event: string;
    detail?: EventDetail;
    /** Whether this node sits inside an action form (for `submit`). */
    inForm?: boolean;
  }
): ActionsResult {
  const { declarations, event, detail } = context;
  const working: Record<string, StateValue> = { ...context.snapshot };
  const changed = new Set<string>();
  const effects: ActionEffect[] = [];
  const writable = (name: unknown): name is string =>
    typeof name === 'string' &&
    Object.hasOwn(declarations, name) &&
    declarations[name]?.source === undefined;
  const fail = (reason: string): ActionsResult => ({ ok: false, reason });
  if (actions.length === 0 || actions.length > 8) return fail('actions');

  for (const action of actions) {
    if (!isBag(action)) return fail('action');
    switch (action.op) {
      case 'setState': {
        if (!writable(action.state)) return fail('state');
        const declaration = declarations[action.state];
        const fromEvent = action.fromEvent === 'value';
        if (fromEvent && event !== 'change' && event !== 'select') return fail('fromEvent');
        if (fromEvent === Object.hasOwn(action, 'value')) return fail('value');
        const raw = fromEvent ? detail?.value : action.value;
        const value = declaration ? coerceStateValue(declaration, raw) : undefined;
        if (value === undefined) return fail('value');
        working[action.state] = value;
        changed.add(action.state);
        break;
      }
      case 'toggleState': {
        if (!writable(action.state) || declarations[action.state]?.type !== 'boolean')
          return fail('state');
        working[action.state] = !working[action.state];
        changed.add(action.state);
        break;
      }
      case 'moveItem': {
        const to = action.to ?? action.from;
        if (!writable(action.from) || !writable(to) || typeof action.item !== 'string')
          return fail('state');
        if (
          declarations[action.from]?.type !== 'list' ||
          declarations[to as string]?.type !== 'list'
        ) {
          return fail('state');
        }
        const index = action.index;
        if (
          index !== undefined &&
          (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 499)
        ) {
          return fail('index');
        }
        const lists: Record<string, readonly ListItem[]> = {
          [action.from]: working[action.from] as readonly ListItem[],
          [to as string]: working[to as string] as readonly ListItem[],
        };
        const maxItems: Record<string, number> = {};
        for (const name of Object.keys(lists)) {
          const declaration = declarations[name];
          if (declaration?.type === 'list') maxItems[name] = declaration.maxItems;
        }
        const moved = moveListItem(lists, maxItems, {
          from: action.from,
          item: action.item,
          to: to as string,
          ...(index !== undefined ? { index } : {}),
        });
        if (!moved.ok) return fail(moved.reason);
        for (const [name, list] of Object.entries(moved.lists)) {
          working[name] = list;
          changed.add(name);
        }
        break;
      }
      case 'flowGo': {
        if (typeof action.event !== 'string' || action.event === '') return fail('event');
        effects.push({ kind: 'flow', event: action.event });
        break;
      }
      case 'emit': {
        if (typeof action.intent !== 'string' || !ACTION_NAME.test(action.intent))
          return fail('intent');
        const values: Record<string, string | number | boolean> = {};
        const raw = action.values ?? {};
        if (!isBag(raw) || Object.keys(raw).length > MAX_EMIT_VALUES) return fail('values');
        for (const [key, entry] of Object.entries(raw)) {
          // Value names follow the spec's intent-name pattern, like the intent.
          if (!ACTION_NAME.test(key)) return fail('values');
          let value: unknown = entry;
          if (isBag(entry)) {
            const name = Object.keys(entry).length === 1 ? entry.$state : undefined;
            if (typeof name !== 'string' || !Object.hasOwn(working, name)) return fail('values');
            value = working[name];
          }
          if (
            typeof value === 'string'
              ? value.length > MAX_EMIT_VALUE_LENGTH
              : typeof value === 'number'
                ? !Number.isFinite(value)
                : typeof value !== 'boolean'
          ) {
            return fail('values');
          }
          Object.defineProperty(values, key, { value, enumerable: true });
        }
        effects.push({ kind: 'emit', intent: action.intent, values: Object.freeze(values) });
        break;
      }
      case 'submit': {
        if (!context.inForm) return fail('submit');
        effects.push({ kind: 'submit' });
        break;
      }
      default:
        return fail('action');
    }
  }
  return { ok: true, snapshot: Object.freeze(working), changed: [...changed], effects };
}
