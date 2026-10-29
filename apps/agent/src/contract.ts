import type { BlueprintEnvelope } from '@texuli/catalog/envelope';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import type { DraftCheckStatus, DraftDiagnostic } from '@texuli/catalog/validate';
import type { BreakerState, KillSwitchSource } from './guard.ts';

/** The request/response contract version (`/v1/draft`). */
export const AGENT_API_VERSION = 'v1';

/**
 * The v1 contract (agent-service design §6): `POST /v1/draft`. Everything a
 * client sends is untrusted (trust boundary A); everything the service
 * returns is still untrusted to the client (boundary D).
 */

/** Advisory limits from the design (§8), enforced before any parsing work. */
export const LIMITS = {
  /** Request body, in UTF-8 bytes, checked before `JSON.parse`. */
  bodyBytes: 64 * 1024,
  /** Prompt length, in characters. */
  promptChars: 4096,
  /** History turns kept and sent to the model (older turns are dropped). */
  historyTurns: 6,
  /** Characters per history turn. */
  historyChars: 4096,
  /** Repair attempts after the first model call. */
  repairs: 2,
} as const;

export interface HistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface DraftRequest {
  prompt: string;
  /** Must equal the service's catalog build hash. */
  catalogHash: string;
  /** The current draft, re-validated before use (the client copy is untrusted). */
  draft?: CatalogTreeInput;
  history?: readonly HistoryTurn[];
  /**
   * Stream the draft as it is written (ADR-014): `draft-chunk`, `node-ready`
   * and `refused` events while the model writes, then `final` instead of
   * `result`. Default false (the v1 event stream, unchanged).
   */
  stream?: boolean;
}

/** What the receipt says ran, per check of the shared validator. */
export type ReceiptChecks = Readonly<Record<string, DraftCheckStatus>>;

/** Privacy-safe action metadata attached to each final draft response. */
export interface ActionReceipt {
  /** Unique per response, matching the guard receipt id convention. */
  id: string;
  artifactKind: 'blueprint-draft' | 'draft-attempt';
  catalogHash: string;
  /** Both provider output and service validation are untrusted. */
  tiers: { providerOutput: 'untrusted'; validation: 'untrusted' };
  /** Total elapsed time for this draft operation, in milliseconds. */
  durationMs: number;
  /** ISO time when the operation completed. */
  at: string;
  /** Provider calls made, including bounded repairs. */
  attempts: number;
}

export interface Receipt extends ActionReceipt {
  checks: ReceiptChecks;
  /** Provider and model label, for transparency. */
  model: string;
  timing: { totalMs: number; gateMs: number };
  usage: { inputTokens: number; outputTokens: number };
}

export interface DraftResult {
  status: 'valid' | 'invalid';
  /** Present only when `status` is `valid`. */
  draft?: CatalogTreeInput;
  /** The draft wrapped in a `draft` envelope. The status is never authority. */
  envelope?: BlueprintEnvelope;
  diagnostics: readonly Pick<DraftDiagnostic, 'code' | 'path' | 'message'>[];
  receipt: Receipt;
  /** Plain text for the chat; the client formats it, never as HTML. */
  note: string;
}

/** Stable error codes (`error` event, or a JSON error body). */
export type AgentErrorCode =
  | 'unavailable'
  | 'too-large'
  | 'bad-request'
  | 'catalog-mismatch'
  | 'invalid-draft'
  | 'rate-limited'
  | 'unauthorized'
  | 'busy'
  | 'provider-error'
  | 'circuit-open';

/**
 * Why a guard refused a request: the receipt for a kill-switch or
 * circuit-breaker stop. It names no prompt text and no caller.
 */
export interface GuardReceipt {
  /** Unique per refusal. */
  id: string;
  guard: 'kill-switch' | 'circuit-breaker' | 'token-budget';
  catalogHash: string;
  /** ISO time of the refusal. */
  at: string;
  /** Which kill-switch setting stopped the service (kill-switch refusals only). */
  source?: KillSwitchSource;
  /** Breaker state at the refusal (circuit-breaker refusals only). */
  breaker?: { state: BreakerState; failures: number; trips: number; retryAt: number | null };
  /** Milliseconds until a retry can succeed, when known. */
  retryAfterMs?: number;
  /** Provider calls made for this request before the stop (0 when refused at admission). */
  attempts: number;
  /** Reported-token ceiling that stopped generation. */
  budget?: { scope: 'session' | 'global'; limit: number; used: number; unit: 'reported-token' };
}

/** Why a streamed node is held until the final verdict (`refused` events). */
export type StreamRefusalReason = 'node' | 'held' | 'stream-order' | 'stream-error';

/**
 * The server-sent event stream. Without `stream`, progress text and one
 * validated `result`. With `stream: true`, also the draft as it is written
 * (ADR-014): `draft-chunk` texts that concatenate to one untrusted draft
 * envelope per attempt (feed them to `<Player stream>`), the service's
 * node-level verdicts (`node-ready`, `refused`), and `final`, the full
 * `validateDraft` verdict, which is the only one that counts.
 */
export type AgentEvent =
  | { type: 'accepted'; requestId: string }
  | { type: 'generating'; text: string }
  | { type: 'validating'; attempt: number }
  | { type: 'repairing'; attempt: number; codes: readonly string[] }
  /** Envelope text of attempt `attempt`; a new attempt starts a new envelope. */
  | { type: 'draft-chunk'; attempt: number; text: string }
  /** A node's shell is final and passed every node-level check. */
  | { type: 'node-ready'; attempt: number; path: string; streamId: string; id: string }
  /** A node (path `$`: the whole attempt) is held with its subtree until the final verdict. */
  | {
      type: 'refused';
      attempt: number;
      path: string;
      reason: StreamRefusalReason;
      codes: readonly string[];
    }
  | { type: 'result'; result: DraftResult }
  /** The final verdict of a streamed request (the `result` of the v1 stream). */
  | { type: 'final'; result: DraftResult }
  | {
      type: 'error';
      code: AgentErrorCode;
      message: string;
      receipt?: GuardReceipt;
      /** Present for provider failures: whether the same request may succeed later. */
      retryable?: boolean;
    }
  | { type: 'done' };

export type AdmissionResult =
  | { ok: true; request: DraftRequest }
  | { ok: false; code: 'too-large' | 'bad-request'; message: string };

const FIELDS = new Set(['prompt', 'catalogHash', 'draft', 'history', 'stream']);
const HASH = /^[0-9a-f]{64}$/;

function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Admission (boundary A): the body cap is checked on the raw text before
 * `JSON.parse`, then the shape is checked strictly. Unknown fields are
 * refused. The history is trimmed to the last `LIMITS.historyTurns` turns.
 * The draft is only shape-checked here; the service re-validates it in full.
 */
export function admitRequest(body: string): AdmissionResult {
  const bytes = utf8Bytes(body);
  if (bytes > LIMITS.bodyBytes) {
    return {
      ok: false,
      code: 'too-large',
      message: `The request is ${bytes} bytes; the limit is ${LIMITS.bodyBytes}.`,
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return { ok: false, code: 'bad-request', message: 'The request is not valid JSON.' };
  }
  const bad = (message: string): AdmissionResult => ({ ok: false, code: 'bad-request', message });
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return bad('The request must be an object.');
  }
  const record = value as Record<string, unknown>;
  const unknown = Object.keys(record).find((key) => !FIELDS.has(key));
  if (unknown !== undefined) return bad(`"${unknown}" is not a request field.`);
  const { prompt, catalogHash, draft, history, stream } = record;
  if (typeof prompt !== 'string' || prompt.trim() === '') return bad('"prompt" must be text.');
  if ([...prompt].length > LIMITS.promptChars) {
    return {
      ok: false,
      code: 'too-large',
      message: `"prompt" is longer than ${LIMITS.promptChars} characters.`,
    };
  }
  if (typeof catalogHash !== 'string' || !HASH.test(catalogHash)) {
    return bad('"catalogHash" must be a catalog build hash.');
  }
  if (
    draft !== undefined &&
    (draft === null || typeof draft !== 'object' || Array.isArray(draft))
  ) {
    return bad('"draft" must be one catalog tree.');
  }
  if (stream !== undefined && typeof stream !== 'boolean')
    return bad('"stream" must be true or false.');
  let turns: HistoryTurn[] | undefined;
  if (history !== undefined) {
    if (!Array.isArray(history)) return bad('"history" must be a list of turns.');
    turns = [];
    for (const turn of history) {
      const t = turn as Record<string, unknown> | null;
      if (
        t === null ||
        typeof t !== 'object' ||
        Object.keys(t).some((key) => key !== 'role' && key !== 'text') ||
        (t.role !== 'user' && t.role !== 'assistant') ||
        typeof t.text !== 'string' ||
        [...t.text].length > LIMITS.historyChars
      ) {
        return bad('Each history turn is { role: "user" | "assistant", text } within the limit.');
      }
      turns.push({ role: t.role, text: t.text });
    }
    turns = turns.slice(-LIMITS.historyTurns);
  }
  return {
    ok: true,
    request: {
      prompt,
      catalogHash,
      ...(draft !== undefined ? { draft: draft as CatalogTreeInput } : {}),
      ...(turns ? { history: turns } : {}),
      ...(stream === true ? { stream: true } : {}),
    },
  };
}
