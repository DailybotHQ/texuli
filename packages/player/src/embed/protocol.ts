import type { PlayerErrorCode, PlayerStatus } from '@texuli/catalog/player';
import { ACTION_NAME, type ActionIntent, actionValues } from '../actions.ts';
import { type DataSources, sanitizeDataSources } from '../host-data.ts';
import type { PlayerLabelOverrides } from '../labels.ts';
import type { PlayerDiagnosticsEvent, PlayerSize } from './types.ts';

/**
 * The player-frame `postMessage` protocol (player design §8), version 1.
 * Every message carries this tag; anything else on the channel is ignored.
 */
export const PLAYER_FRAME_PROTOCOL = 'texuli.player-frame/1';

/**
 * Sandbox for a player frame: scripts only. No `allow-same-origin`, so the
 * frame runs in an opaque origin and cannot read the host page, its cookies
 * or its storage; no forms, popups or top navigation.
 */
export const PLAYER_FRAME_SANDBOX = 'allow-scripts';

/** Referrer policy for a player frame. */
export const PLAYER_FRAME_REFERRER_POLICY = 'no-referrer';

/** The host-chosen options that may cross the frame boundary. Plain data only. */
export interface PlayerFrameOptions {
  tier?: 'untrusted' | 'developer';
  status?: Exclude<PlayerStatus, 'invalid'>;
  invalidPolicy?: 'refuse' | 'preview';
  label?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  lang?: string;
  density?: 'comfortable' | 'compact';
  labels?: PlayerLabelOverrides;
  /** `false` makes the painted surface inert (an off-screen or background frame). */
  active?: boolean;
  /** `reduce` stops motion inside the player regardless of the user setting. */
  motion?: 'auto' | 'reduce';
  /** The initial flow view (G09), when the host mirrors it. */
  view?: string;
}

/** Host → frame. */
export type PlayerFrameHostMessage =
  | {
      protocol: typeof PLAYER_FRAME_PROTOCOL;
      type: 'init';
      blueprint: unknown;
      options: PlayerFrameOptions;
    }
  | {
      protocol: typeof PLAYER_FRAME_PROTOCOL;
      type: 'update';
      blueprint?: unknown;
      status?: Exclude<PlayerStatus, 'invalid'>;
      /** The flow view the host mirrors (G09), for example from its URL. */
      view?: string;
    }
  | {
      protocol: typeof PLAYER_FRAME_PROTOCOL;
      /** The host's answer to an action intent (G17). */
      type: 'action-result';
      id: string;
      status: 'confirmed' | 'rejected' | 'failed';
    }
  | {
      protocol: typeof PLAYER_FRAME_PROTOCOL;
      /** Host data for host-bound state variables (host G01). */
      type: 'data';
      sources: DataSources;
    };

/** The validation summary a frame reports; counts and codes, no content. */
export interface PlayerFrameDiagnostics {
  status: PlayerStatus;
  ok: boolean;
  error?: PlayerErrorCode;
  errors: number;
  warnings: number;
}

/** Frame → host. */
export type PlayerFrameMessage =
  | { protocol: typeof PLAYER_FRAME_PROTOCOL; type: 'ready' }
  | ({ protocol: typeof PLAYER_FRAME_PROTOCOL; type: 'resize' } & PlayerSize)
  | ({ protocol: typeof PLAYER_FRAME_PROTOCOL; type: 'diagnostics' } & PlayerFrameDiagnostics)
  | ({ protocol: typeof PLAYER_FRAME_PROTOCOL; type: 'flow' } & PlayerFrameFlowChange)
  | ({ protocol: typeof PLAYER_FRAME_PROTOCOL; type: 'action' } & ActionIntent);

/** An action intent's id, as the player numbers them. */
const ACTION_ID = /^action-[0-9]{1,9}$/;

/** Rebuild action values from untrusted data with the action caps, or `null`. */
function frameActionValues(value: unknown): ActionIntent['values'] | null {
  if (!isBag(value)) return null;
  return actionValues(
    Object.entries(value).map(
      ([name, entry]) => [name, isScalar(entry) ? entry : undefined] as const
    )
  );
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/** A flow action moved the view (G09): the host may mirror `to` into its URL. */
export interface PlayerFrameFlowChange {
  from: string;
  to: string;
  event: string;
}

/** A flow view or event name, as the flow declaration allows it. */
const FLOW_NAME = /^[a-z][a-z0-9-]{0,31}$/;

function flowName(value: unknown): string | undefined {
  return typeof value === 'string' && FLOW_NAME.test(value) ? value : undefined;
}

/** Upper bound on a reported frame size, so a hostile frame cannot ask for an absurd height. */
export const PLAYER_FRAME_MAX_SIZE = 100_000;
const MAX_LABEL_LENGTH = 500;

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tagged(data: unknown): Bag | null {
  return isBag(data) && data.protocol === PLAYER_FRAME_PROTOCOL ? data : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function shortText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= MAX_LABEL_LENGTH ? value : undefined;
}

function size(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(Math.ceil(value), PLAYER_FRAME_MAX_SIZE)
    : undefined;
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

const STATUSES = ['draft', 'active', 'superseded'] as const;
const ALL_STATUSES = ['invalid', 'draft', 'active', 'superseded'] as const;
const ERROR_CODES = ['parse', 'over-limits', 'catalog-mismatch', 'invalid'] as const;
const LABEL_KEYS = [
  'invalidNotice',
  'previewWarning',
  'loading',
  'position',
  'skip',
  'contents',
  'speakerNotes',
  'trustBadge',
  'selected',
  'selectedOne',
  'painted',
  'placeholdersUnresolved',
  'statusChanged',
  'mediaNoAlt',
] as const;
const PLACEHOLDER_KEYS = ['unknown-id', 'tier-denied', 'no-loader', 'node-error'] as const;

function textMap<K extends string>(value: unknown, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  if (!isBag(value)) return out;
  for (const key of keys) {
    const text = shortText(value[key]);
    if (text !== undefined) out[key] = text;
  }
  return out;
}

function sanitizeLabels(value: unknown): PlayerLabelOverrides | undefined {
  if (!isBag(value)) return undefined;
  return {
    ...textMap(value, LABEL_KEYS),
    status: textMap(value.status, ALL_STATUSES),
    placeholders: textMap(value.placeholders, PLACEHOLDER_KEYS),
  };
}

/** Rebuild frame options from untrusted data, keeping only known keys with valid values. */
export function sanitizeFrameOptions(value: unknown): PlayerFrameOptions {
  if (!isBag(value)) return {};
  const options: PlayerFrameOptions = {};
  const tier = oneOf(value.tier, ['untrusted', 'developer'] as const);
  const status = oneOf(value.status, STATUSES);
  const invalidPolicy = oneOf(value.invalidPolicy, ['refuse', 'preview'] as const);
  const label = shortText(value.label);
  const dir = oneOf(value.dir, ['ltr', 'rtl', 'auto'] as const);
  const lang = shortText(value.lang);
  const density = oneOf(value.density, ['comfortable', 'compact'] as const);
  const labels = sanitizeLabels(value.labels);
  if (tier) options.tier = tier;
  if (status) options.status = status;
  if (invalidPolicy) options.invalidPolicy = invalidPolicy;
  if (label !== undefined) options.label = label;
  if (dir) options.dir = dir;
  if (lang !== undefined) options.lang = lang;
  if (density) options.density = density;
  if (labels) options.labels = labels;
  if (typeof value.active === 'boolean') options.active = value.active;
  const motion = oneOf(value.motion, ['auto', 'reduce'] as const);
  if (motion) options.motion = motion;
  const view = flowName(value.view);
  if (view) options.view = view;
  return options;
}

/** Parse a host → frame message, or `null` when it is not a well-formed protocol message. */
export function parseHostMessage(data: unknown): PlayerFrameHostMessage | null {
  const bag = tagged(data);
  if (!bag) return null;
  if (bag.type === 'init') {
    if (!Object.hasOwn(bag, 'blueprint')) return null;
    return {
      protocol: PLAYER_FRAME_PROTOCOL,
      type: 'init',
      blueprint: bag.blueprint,
      options: sanitizeFrameOptions(bag.options),
    };
  }
  if (bag.type === 'data') {
    const sources = sanitizeDataSources(bag.sources);
    return sources ? { protocol: PLAYER_FRAME_PROTOCOL, type: 'data', sources } : null;
  }
  if (bag.type === 'action-result') {
    const status = oneOf(bag.status, ['confirmed', 'rejected', 'failed'] as const);
    if (typeof bag.id !== 'string' || !ACTION_ID.test(bag.id) || !status) return null;
    return { protocol: PLAYER_FRAME_PROTOCOL, type: 'action-result', id: bag.id, status };
  }
  if (bag.type === 'update') {
    const message: PlayerFrameHostMessage = { protocol: PLAYER_FRAME_PROTOCOL, type: 'update' };
    if (Object.hasOwn(bag, 'blueprint')) message.blueprint = bag.blueprint;
    const status = oneOf(bag.status, STATUSES);
    if (status) message.status = status;
    const view = flowName(bag.view);
    if (view) message.view = view;
    return message;
  }
  return null;
}

/** Parse a frame → host message, or `null` when it is not a well-formed protocol message. */
export function parseFrameMessage(data: unknown): PlayerFrameMessage | null {
  const bag = tagged(data);
  if (!bag) return null;
  if (bag.type === 'ready') return { protocol: PLAYER_FRAME_PROTOCOL, type: 'ready' };
  if (bag.type === 'resize') {
    const blockSize = size(bag.blockSize);
    const inlineSize = size(bag.inlineSize);
    if (blockSize === undefined || inlineSize === undefined) return null;
    return { protocol: PLAYER_FRAME_PROTOCOL, type: 'resize', blockSize, inlineSize };
  }
  if (bag.type === 'action') {
    const values = frameActionValues(bag.values);
    if (
      typeof bag.id !== 'string' ||
      !ACTION_ID.test(bag.id) ||
      typeof bag.action !== 'string' ||
      !ACTION_NAME.test(bag.action) ||
      !values
    ) {
      return null;
    }
    return {
      protocol: PLAYER_FRAME_PROTOCOL,
      type: 'action',
      id: bag.id,
      action: bag.action,
      values,
    };
  }
  if (bag.type === 'flow') {
    const from = flowName(bag.from);
    const to = flowName(bag.to);
    const event = flowName(bag.event);
    if (!from || !to || !event) return null;
    return { protocol: PLAYER_FRAME_PROTOCOL, type: 'flow', from, to, event };
  }
  if (bag.type === 'diagnostics') {
    const status = oneOf(bag.status, ALL_STATUSES);
    const errors = count(bag.errors);
    const warnings = count(bag.warnings);
    if (!status || errors === undefined || warnings === undefined || typeof bag.ok !== 'boolean') {
      return null;
    }
    const error = oneOf(bag.error, ERROR_CODES);
    return {
      protocol: PLAYER_FRAME_PROTOCOL,
      type: 'diagnostics',
      status,
      ok: bag.ok,
      errors,
      warnings,
      ...(error ? { error } : {}),
    };
  }
  return null;
}

/** Reduce a player diagnostics event to what may cross the frame boundary. */
export function frameDiagnostics(event: PlayerDiagnosticsEvent): PlayerFrameDiagnostics {
  return {
    status: event.status,
    ok: event.receipt?.ok ?? false,
    errors: event.receipt?.errors ?? event.stateIssues.length,
    warnings: event.receipt?.warnings ?? 0,
    ...(event.error ? { error: event.error } : {}),
  };
}
