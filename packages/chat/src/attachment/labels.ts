/** Visible and accessible text of a `ChatAttachment` card. */
export interface ChatAttachmentLabels {
  /** Title when the host gives none. */
  attachment: string;
  /** Disclosure button while the preview is hidden. */
  show: string;
  /** Disclosure button while the preview is shown. */
  hide: string;
  /** Heading of the refused state. */
  refused: string;
  /** Lead-in of the list of reasons. */
  reasons: string;
  /** Reason shown when the check itself failed. */
  checkFailed: string;
}

export const DEFAULT_CHAT_ATTACHMENT_LABELS: ChatAttachmentLabels = {
  attachment: 'Blueprint attachment',
  show: 'Show preview',
  hide: 'Hide preview',
  refused: 'This attachment was not shown',
  reasons: 'It did not pass validation:',
  checkFailed: 'The attachment could not be checked.',
};

/**
 * What a host's `check` answers for an attachment: a validated value to paint,
 * or the reasons it was refused (plain text). The card never paints a refused one.
 */
export type ChatAttachmentCheck =
  | { readonly ok: true; readonly value: unknown; readonly summary?: string }
  | { readonly ok: false; readonly reasons: readonly string[] };

/** Most reasons a refused card lists, and the longest one (characters). */
export const CHAT_ATTACHMENT_LIMITS = Object.freeze({ reasons: 5, reason: 200 });

/**
 * Run a host check without trusting it: a throw, a malformed answer or an empty
 * reason list reads as refused, and reasons are capped in count and length.
 */
export function runAttachmentCheck(
  check: (artifact: unknown) => ChatAttachmentCheck,
  artifact: unknown,
  labels: Pick<ChatAttachmentLabels, 'checkFailed'>
): ChatAttachmentCheck {
  let result: unknown;
  try {
    result = check(artifact);
  } catch {
    return { ok: false, reasons: [labels.checkFailed] };
  }
  if (typeof result !== 'object' || result === null)
    return { ok: false, reasons: [labels.checkFailed] };
  const answer = result as Record<string, unknown>;
  if (answer.ok === true && 'value' in answer) {
    const summary =
      typeof answer.summary === 'string'
        ? answer.summary.slice(0, CHAT_ATTACHMENT_LIMITS.reason)
        : undefined;
    return summary ? { ok: true, value: answer.value, summary } : { ok: true, value: answer.value };
  }
  const reasons = Array.isArray(answer.reasons)
    ? answer.reasons
        .filter((reason): reason is string => typeof reason === 'string' && reason.trim() !== '')
        .slice(0, CHAT_ATTACHMENT_LIMITS.reasons)
        .map((reason) => reason.slice(0, CHAT_ATTACHMENT_LIMITS.reason))
    : [];
  return { ok: false, reasons: reasons.length > 0 ? reasons : [labels.checkFailed] };
}
