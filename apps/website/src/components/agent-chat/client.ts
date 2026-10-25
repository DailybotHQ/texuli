/**
 * The chat island's client for the agent service (`/v1`). Framework-free:
 * the island and tests share it. Everything the service returns is still
 * untrusted (trust boundary D): drafts are painted by the player, which
 * re-validates them in the untrusted tier, and text is shown as plain text.
 */

/** The parts of the service's result the island reads. */
export interface AgentDraftResult {
  status: 'valid' | 'invalid';
  draft?: unknown;
  envelope?: unknown;
  diagnostics: readonly { code: string; path: string; message: string }[];
  receipt: {
    id: string;
    catalogHash: string;
    checks: Readonly<Record<string, string>>;
    attempts: number;
    model: string;
    timing: { totalMs: number; gateMs: number };
    usage: { inputTokens: number; outputTokens: number };
  };
  note: string;
}

export type AgentStreamEvent =
  | { type: 'accepted'; requestId: string }
  | { type: 'generating'; text: string }
  | { type: 'validating'; attempt: number }
  | { type: 'repairing'; attempt: number; codes: readonly string[] }
  | { type: 'result'; result: AgentDraftResult }
  | { type: 'error'; code: string; message: string }
  | { type: 'done' };

export type Unavailable = 'not-configured' | 'disabled' | 'offline' | 'catalog-mismatch';

export type Connection =
  | { ok: true; endpoint: string; token: string | null }
  | { ok: false; reason: Unavailable };

export interface DraftOutcome {
  result?: AgentDraftResult;
  error?: { code: string; message: string };
}

const EVENT_TYPES = new Set([
  'accepted',
  'generating',
  'validating',
  'repairing',
  'result',
  'error',
  'done',
]);
/** Largest unparsed stream buffer kept; a longer frame ends the stream. */
const MAX_FRAME = 1024 * 1024;

/**
 * The configured service origin, or `null`. Only an absolute `https:` URL
 * (or `http://localhost` for local development) is accepted.
 */
export function agentEndpoint(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value.trim());
    const local =
      url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    if (url.protocol !== 'https:' && !local) return null;
    if (url.username || url.password) return null;
    return url.href.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/**
 * Check the service before enabling the chat: it must be reachable, turned
 * on (the kill switch) and built from the same catalog as this site. Then
 * start an anonymous session when the service issues tokens.
 */
export async function connect(
  endpoint: string | null,
  catalogHash: string,
  fetcher: typeof fetch = fetch
): Promise<Connection> {
  if (!endpoint) return { ok: false, reason: 'not-configured' };
  try {
    const health = await fetcher(`${endpoint}/v1/health`, {
      headers: { accept: 'application/json' },
    });
    if (!health.ok) return { ok: false, reason: 'offline' };
    const data = (await health.json()) as { enabled?: unknown; catalogHash?: unknown };
    if (data.enabled !== true) return { ok: false, reason: 'disabled' };
    if (data.catalogHash !== catalogHash) return { ok: false, reason: 'catalog-mismatch' };
    const session = await fetcher(`${endpoint}/v1/session`, { method: 'POST' });
    const token = session.ok ? ((await session.json()) as { token?: unknown }).token : null;
    return { ok: true, endpoint, token: typeof token === 'string' ? token : null };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

/** Parse a server-sent event stream into known events; unknown frames are skipped. */
export async function* readEvents(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<AgentStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > MAX_FRAME) return;
      let end = buffer.indexOf('\n\n');
      while (end !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data) {
          try {
            const event = JSON.parse(data) as { type?: unknown };
            if (typeof event.type === 'string' && EVENT_TYPES.has(event.type)) {
              yield event as AgentStreamEvent;
            }
          } catch {
            // A malformed frame is ignored, never evaluated.
          }
        }
        end = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Send one prompt and follow its event stream until the result or an error. */
export async function requestDraft(
  connection: Extract<Connection, { ok: true }>,
  body: {
    prompt: string;
    catalogHash: string;
    draft?: unknown;
    history?: readonly { role: string; text: string }[];
  },
  onEvent: (event: AgentStreamEvent) => void,
  options: { fetch?: typeof fetch; signal?: AbortSignal } = {}
): Promise<DraftOutcome> {
  const fetcher = options.fetch ?? fetch;
  try {
    const response = await fetcher(`${connection.endpoint}/v1/draft`, {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        ...(connection.token ? { authorization: `Bearer ${connection.token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
    if (!response.ok || !response.body) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: unknown;
        message?: unknown;
      };
      return {
        error: {
          code: typeof data.error === 'string' ? data.error : 'offline',
          message: typeof data.message === 'string' ? data.message : 'The agent did not answer.',
        },
      };
    }
    for await (const event of readEvents(response.body)) {
      onEvent(event);
      if (event.type === 'result') return { result: event.result };
      if (event.type === 'error') return { error: { code: event.code, message: event.message } };
    }
    return { error: { code: 'offline', message: 'The answer ended early.' } };
  } catch {
    return { error: { code: 'offline', message: 'The agent could not be reached.' } };
  }
}
