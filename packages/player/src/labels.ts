import type { PlayerStatus } from '@texuli/catalog/player';
import type { PlayerNodeErrorCode } from './errors.ts';
import { placeholderMessage } from './errors.ts';

/** The status the player shows: the host's or its own verdict, or a streaming state (ADR-014). */
export type PlayerShownStatus = PlayerStatus | 'streaming' | 'interrupted';

/** Every piece of chrome copy the player paints; hosts localize it through `labels`. */
export interface PlayerLabels {
  status: Readonly<Record<PlayerShownStatus, string>>;
  /** Heading of the notice shown when an invalid draft is refused. */
  invalidNotice: string;
  /** Banner under an invalid draft painted with `invalidPolicy="preview"`. */
  previewWarning: string;
  /** Prefix of a skeleton's loading announcement ("Loading" + catalog label). */
  loading: string;
  /** Fixed explanation under each per-node placeholder. */
  placeholders: Readonly<Record<PlayerNodeErrorCode, string>>;
  /** Prefix before a placeholder's tree position. */
  position: string;
  /** Skip link text before the player label ("Skip" + label). */
  skip: string;
  /** Name of a document's table of contents. */
  contents: string;
  /** Summary of a slide's speaker notes in the document flow. */
  speakerNotes: string;
  /**
   * Trust badge shown on every `untrusted`-tier player (the artifact frame
   * contract: agent output stays distinguishable from app chrome).
   */
  trustBadge: string;
  /** Several frames selected: "{count} selected" (a plain word is prefixed with the count). */
  selected: string;
  /** One frame selected: "{name} selected". */
  selectedOne: string;
  /** Polite paint announcement: "{frames}" is the number of layout frames. */
  painted: string;
  /** Appended when nodes painted as placeholders: "{count}". */
  placeholdersUnresolved: string;
  /** Appended when the host status is not draft: "{status}". */
  statusChanged: string;
  /** Alt text for a `media-image` whose blueprint `alt` was blank. */
  mediaNoAlt: string;
  /** Under the label of a host region the host does not provide here. */
  hostRegionMissing: string;
  /** Under the label of a second host region with a name already shown. */
  hostRegionDuplicate: string;

  /** Polite announcement after a flow action: "{view}" is the view's label. */
  flowChanged: string;
  /** Action receipts (G17). */
  actionPending: string;
  actionConfirmed: string;
  actionRejected: string;
  actionFailed: string;
  actionUnavailable: string;
  /** Announced when a node's actions are refused (a value that does not fit, a locked item). */
  actionRefused: string;
  /** Field errors: "{label}", and "{min}"/"{max}" for length and range. */
  fieldRequired: string;
  fieldPattern: string;
  fieldLength: string;
  fieldRange: string;

  /** Streaming (ADR-014): said once when a stream starts painting. */
  streamStarted: string;
  /** Polite progress while streaming, at most every few seconds: "{count}" parts shown. */
  streamProgress: string;
  /** The recoverable error after a stream stopped early. */
  streamInterrupted: string;
  /** The retry button of that error (shown when the host passes `onStreamRetry`). */
  streamRetry: string;
  /** A skeleton whose catalog id has not arrived yet. */
  streamPending: string;
  /** A node held until the whole draft is checked (a node-level refusal or a member out of order). */
  streamHeld: string;
  /** A node the interrupted stream never finished. */
  streamIncomplete: string;

  /** A `document` node painted without a document host (spec 0.7.0): only previews reach it. */
  documentNeedsHost: string;
  /** A `canvas` node painted without a canvas host (spec 0.8.0): only previews reach it. */
  canvasNeedsHost: string;

  // Data sources (spec 0.8.0): a node whose rows come from the host's source.
  /** Shown while a bound node's first rows load. `{label}`: the node's caption or label. */
  sourceLoading: string;
  /** A bound node whose source returned no rows. */
  sourceEmpty: string;
  /** Announced and shown when a bound node's rows could not load. `{label}`, `{reason}`. */
  sourceFailed: string;
  /** The retry button of a failed load. */
  sourceRetry: string;
  /** The button that loads the next page. */
  sourceLoadMore: string;
  /** Shown on the button while the next page loads. */
  sourceLoadingMore: string;
  /** Announced after a page loads. `{count}`: rows added. */
  sourceLoadedMore: string;
  /** Announced and shown when an edit was refused and undone. `{reason}`. */
  sourceSaveFailed: string;
  /** Host translations of the data-source error reasons, by message key (`dataSource.error.<code>`). */
  sourceErrors: Readonly<Record<string, string>>;
}

export const DEFAULT_PLAYER_LABELS: PlayerLabels = Object.freeze({
  status: Object.freeze({
    invalid: 'Invalid draft',
    draft: 'Draft',
    active: 'Active',
    superseded: 'Superseded',
    streaming: 'Generating',
    interrupted: 'Interrupted',
  }),
  invalidNotice: 'This blueprint could not be validated.',
  previewWarning: 'Preview only. This invalid blueprint cannot be activated.',
  loading: 'Loading',
  placeholders: Object.freeze({
    'unknown-id': placeholderMessage('unknown-id'),
    'tier-denied': placeholderMessage('tier-denied'),
    'no-loader': placeholderMessage('no-loader'),
    'node-error': placeholderMessage('node-error'),
  }),
  position: 'Position',
  skip: 'Skip past',
  contents: 'Contents',
  speakerNotes: 'Speaker notes',
  trustBadge: 'Untrusted content',
  selected: '{count} selected',
  selectedOne: '{name} selected',
  painted: 'Content ready: {frames} sections.',
  placeholdersUnresolved: '{count} parts could not be shown.',
  statusChanged: 'Status: {status}.',
  mediaNoAlt: 'Image without a description',
  hostRegionMissing: 'Provided by the app; not available here.',
  hostRegionDuplicate: 'Already shown above.',

  flowChanged: 'Now showing {view}.',
  actionPending: 'Sending…',
  actionConfirmed: 'Sent.',
  actionRejected: 'Not accepted.',
  actionFailed: 'Could not send. Please try again.',
  actionUnavailable: 'This preview cannot send.',
  actionRefused: 'That change is not allowed here.',
  fieldRequired: '{label} is required.',
  fieldPattern: '{label} is not in the expected format.',
  fieldLength: '{label} must be {min} to {max} characters.',
  fieldRange: '{label} must be between {min} and {max}.',

  streamStarted: 'Generating content.',
  streamProgress: '{count} parts shown so far.',
  streamInterrupted:
    'Generation stopped before the content was complete. What is shown is incomplete.',
  streamRetry: 'Try again',
  streamPending: 'Content',
  streamHeld: 'Waiting for the complete draft.',
  streamIncomplete: 'Not received.',

  documentNeedsHost: 'This document opens in a document reader.',
  canvasNeedsHost: 'This canvas opens in a canvas viewer.',

  sourceLoading: 'Loading {label}…',
  sourceEmpty: 'Nothing to show yet.',
  sourceFailed: '{label} could not be loaded. {reason}',
  sourceRetry: 'Try again',
  sourceLoadMore: 'Load more',
  sourceLoadingMore: 'Loading more…',
  sourceLoadedMore: '{count} more shown.',
  sourceSaveFailed: 'The change was not saved and has been undone. {reason}',
  sourceErrors: Object.freeze({}),
});

/** Host overrides; nested maps merge per key. */
export type PlayerLabelOverrides = Partial<
  Omit<PlayerLabels, 'status' | 'placeholders'> & {
    status: Partial<PlayerLabels['status']>;
    placeholders: Partial<PlayerLabels['placeholders']>;
  }
>;

/** Only non-empty string translations under `dataSource.error.*` keys are kept. */
function sourceErrorTexts(value: unknown): Readonly<Record<string, string>> {
  if (typeof value !== 'object' || value === null) return DEFAULT_PLAYER_LABELS.sourceErrors;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key.startsWith('dataSource.error.') && typeof entry === 'string' && entry.trim() !== '') {
      Object.defineProperty(out, key, { value: entry, enumerable: true });
    }
  }
  return Object.freeze(out);
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

/**
 * Merge host label overrides onto the defaults. Only non-empty strings are
 * taken; anything else keeps the default, so a bad override never blanks the
 * chrome. Labels are painted as text, never as HTML.
 */
export function resolvePlayerLabels(overrides: PlayerLabelOverrides | undefined): PlayerLabels {
  const base = DEFAULT_PLAYER_LABELS;
  if (!overrides) return base;
  const status = overrides.status ?? {};
  const placeholders = overrides.placeholders ?? {};
  return {
    status: {
      invalid: text(status.invalid, base.status.invalid),
      draft: text(status.draft, base.status.draft),
      active: text(status.active, base.status.active),
      superseded: text(status.superseded, base.status.superseded),
      streaming: text(status.streaming, base.status.streaming),
      interrupted: text(status.interrupted, base.status.interrupted),
    },
    invalidNotice: text(overrides.invalidNotice, base.invalidNotice),
    previewWarning: text(overrides.previewWarning, base.previewWarning),
    loading: text(overrides.loading, base.loading),
    placeholders: {
      'unknown-id': text(placeholders['unknown-id'], base.placeholders['unknown-id']),
      'tier-denied': text(placeholders['tier-denied'], base.placeholders['tier-denied']),
      'no-loader': text(placeholders['no-loader'], base.placeholders['no-loader']),
      'node-error': text(placeholders['node-error'], base.placeholders['node-error']),
    },
    position: text(overrides.position, base.position),
    skip: text(overrides.skip, base.skip),
    contents: text(overrides.contents, base.contents),
    speakerNotes: text(overrides.speakerNotes, base.speakerNotes),
    trustBadge: text(overrides.trustBadge, base.trustBadge),
    selected: text(overrides.selected, base.selected),
    selectedOne: text(overrides.selectedOne, base.selectedOne),
    painted: text(overrides.painted, base.painted),
    placeholdersUnresolved: text(overrides.placeholdersUnresolved, base.placeholdersUnresolved),
    statusChanged: text(overrides.statusChanged, base.statusChanged),
    mediaNoAlt: text(overrides.mediaNoAlt, base.mediaNoAlt),
    hostRegionMissing: text(overrides.hostRegionMissing, base.hostRegionMissing),
    hostRegionDuplicate: text(overrides.hostRegionDuplicate, base.hostRegionDuplicate),

    flowChanged: text(overrides.flowChanged, base.flowChanged),
    actionPending: text(overrides.actionPending, base.actionPending),
    actionConfirmed: text(overrides.actionConfirmed, base.actionConfirmed),
    actionRejected: text(overrides.actionRejected, base.actionRejected),
    actionFailed: text(overrides.actionFailed, base.actionFailed),
    actionUnavailable: text(overrides.actionUnavailable, base.actionUnavailable),
    actionRefused: text(overrides.actionRefused, base.actionRefused),
    fieldRequired: text(overrides.fieldRequired, base.fieldRequired),
    fieldPattern: text(overrides.fieldPattern, base.fieldPattern),
    fieldLength: text(overrides.fieldLength, base.fieldLength),
    fieldRange: text(overrides.fieldRange, base.fieldRange),

    streamStarted: text(overrides.streamStarted, base.streamStarted),
    streamProgress: text(overrides.streamProgress, base.streamProgress),
    streamInterrupted: text(overrides.streamInterrupted, base.streamInterrupted),
    streamRetry: text(overrides.streamRetry, base.streamRetry),
    streamPending: text(overrides.streamPending, base.streamPending),
    streamHeld: text(overrides.streamHeld, base.streamHeld),
    streamIncomplete: text(overrides.streamIncomplete, base.streamIncomplete),
    documentNeedsHost: text(overrides.documentNeedsHost, base.documentNeedsHost),
    canvasNeedsHost: text(overrides.canvasNeedsHost, base.canvasNeedsHost),
    sourceLoading: text(overrides.sourceLoading, base.sourceLoading),
    sourceEmpty: text(overrides.sourceEmpty, base.sourceEmpty),
    sourceFailed: text(overrides.sourceFailed, base.sourceFailed),
    sourceRetry: text(overrides.sourceRetry, base.sourceRetry),
    sourceLoadMore: text(overrides.sourceLoadMore, base.sourceLoadMore),
    sourceLoadingMore: text(overrides.sourceLoadingMore, base.sourceLoadingMore),
    sourceLoadedMore: text(overrides.sourceLoadedMore, base.sourceLoadedMore),
    sourceSaveFailed: text(overrides.sourceSaveFailed, base.sourceSaveFailed),
    sourceErrors: sourceErrorTexts(overrides.sourceErrors),
  };
}

/** A BCP 47-shaped language tag, or `undefined` so a bad value never reaches `lang`. */
export function safeLang(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value) ? value : undefined;
}
