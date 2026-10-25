import {
  AGENT_API_VERSION,
  type AgentErrorCode,
  type AgentEvent,
  admitRequest,
  type GuardReceipt,
  LIMITS,
} from './contract.ts';
import { type CspReportStore, handleCspReport } from './csp-reports.ts';
import { isSessionSecretUsable, issueSession, verifySession } from './limits.ts';
import type { AgentService } from './service.ts';

/**
 * The HTTP surface on the standard fetch API (`Request` → `Response`), so
 * the edge worker and the Node dev server share it. Routes:
 * `GET /v1/health`, `POST /v1/session`, `GET /v1/receipts`,
 * `POST /v1/draft` (server-sent events with `Accept: text/event-stream`, else
 * one JSON result) and, when a report store is given, `POST /v1/csp-reports`
 * (CSP violation reports from texuli.com pages). Anything else is 404: there is no activate, publish or send
 * route.
 */

export interface HttpOptions {
  service: AgentService;
  /** The one browser origin allowed (CORS). Requests from other origins get 403. */
  allowedOrigin?: string;
  /** Signs anonymous session tokens. Without it, the caller's IP is the session (dev). */
  sessionSecret?: string;
  /** Edge adapters set this to refuse protected routes when signing is unconfigured. */
  requireSession?: boolean;
  /** The caller's IP, from the platform (e.g. a trusted header). */
  ipOf?: (request: Request) => string;
  clock?: () => number;
  /** Enables `POST /v1/csp-reports`; reports are reduced and counted here. */
  cspReports?: CspReportStore;
}

const STATUS: Record<AgentErrorCode, number> = {
  unavailable: 503,
  'too-large': 413,
  'bad-request': 400,
  'catalog-mismatch': 409,
  'invalid-draft': 422,
  'rate-limited': 429,
  unauthorized: 401,
  busy: 429,
  'provider-error': 502,
  'circuit-open': 503,
};

const BASE_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

function corsHeaders(request: Request, options: HttpOptions): Record<string, string> {
  const origin = request.headers.get('origin');
  return origin !== null && origin === options.allowedOrigin
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-headers': 'authorization, content-type, accept',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        vary: 'Origin',
      }
    : { vary: 'Origin' };
}

function json(request: Request, options: HttpOptions, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...BASE_HEADERS,
      ...corsHeaders(request, options),
      'content-type': 'application/json',
    },
  });
}

function error(
  request: Request,
  options: HttpOptions,
  code: AgentErrorCode | 'not-found' | 'method-not-allowed' | 'forbidden',
  message: string,
  receipt?: GuardReceipt
): Response {
  const status =
    code === 'not-found'
      ? 404
      : code === 'method-not-allowed'
        ? 405
        : code === 'forbidden'
          ? 403
          : STATUS[code];
  const response = json(request, options, status, {
    error: code,
    message,
    ...(receipt ? { receipt } : {}),
  });
  if (receipt?.retryAfterMs !== undefined) {
    response.headers.set(
      'retry-after',
      String(Math.max(1, Math.ceil(receipt.retryAfterMs / 1000)))
    );
  }
  return response;
}

/** Read at most `limit` bytes; `null` when the body is larger (the rest is never buffered). */
async function readCapped(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Server-sent event framing for one event. */
export function sseFrame(event: AgentEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Guard state for `/v1/health`: no prompt text, no caller data. */
function healthGuards(service: AgentService) {
  const { killSwitch, breaker } = service.guards;
  return {
    killSwitch: { enabled: killSwitch.enabled, source: killSwitch.source },
    breaker: {
      state: breaker.state,
      failures: breaker.failures,
      trips: breaker.trips,
      retryAt: breaker.retryAt,
    },
  };
}

/** Handle one HTTP request. Never throws. */
export async function handleRequest(request: Request, options: HttpOptions): Promise<Response> {
  const clock = options.clock ?? (() => Date.now());
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== options.allowedOrigin) {
    return error(request, options, 'forbidden', 'This origin may not call the agent.');
  }
  const route = url.pathname.replace(/\/+$/, '');
  const routes: Record<string, readonly string[]> = {
    [`/${AGENT_API_VERSION}/health`]: ['GET'],
    [`/${AGENT_API_VERSION}/session`]: ['POST'],
    [`/${AGENT_API_VERSION}/receipts`]: ['GET'],
    [`/${AGENT_API_VERSION}/draft`]: ['POST'],
    ...(options.cspReports ? { [`/${AGENT_API_VERSION}/csp-reports`]: ['POST'] } : {}),
  };
  const methods = routes[route];
  if (!methods) return error(request, options, 'not-found', 'No such route.');
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...BASE_HEADERS, ...corsHeaders(request, options) },
    });
  }
  if (!methods.includes(request.method)) {
    return error(request, options, 'method-not-allowed', `Use ${methods.join(', ')}.`);
  }

  if (route.endsWith('/csp-reports') && options.cspReports) {
    // Observability, not generation: neither the kill switch nor a session applies.
    return handleCspReport(request, options.cspReports);
  }
  if (route.endsWith('/health')) {
    const reports = options.cspReports?.snapshot();
    return json(request, options, 200, {
      ok: true,
      api: AGENT_API_VERSION,
      enabled: options.service.enabled,
      catalogHash: options.service.catalogHash,
      guards: healthGuards(options.service),
      ...(reports ? { cspReports: { accepted: reports.accepted, dropped: reports.dropped } } : {}),
    });
  }
  if (route.endsWith('/session')) {
    if (options.requireSession && !isSessionSecretUsable(options.sessionSecret)) {
      return error(request, options, 'unavailable', 'Session signing is not configured.');
    }
    if (!options.sessionSecret) return json(request, options, 200, { token: null });
    return json(request, options, 200, {
      token: await issueSession(options.sessionSecret, clock()),
    });
  }

  if (options.requireSession && !isSessionSecretUsable(options.sessionSecret)) {
    return error(request, options, 'unavailable', 'Session signing is not configured.');
  }
  const ip = options.ipOf?.(request) ?? 'unknown';
  let session = `ip:${ip}`;
  if (options.sessionSecret) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const sid = token ? await verifySession(token, options.sessionSecret, clock()) : null;
    if (!sid)
      return error(request, options, 'unauthorized', 'Start a session first (POST /v1/session).');
    session = `sid:${sid}`;
  }
  if (route.endsWith('/receipts')) {
    return json(request, options, 200, { receipts: await options.service.receipts(session) });
  }

  // POST /v1/draft
  const refusal = options.service.admissionRefusal();
  if (refusal) return error(request, options, refusal.code, refusal.message, refusal.receipt);
  const body = await readCapped(request, LIMITS.bodyBytes);
  if (body === null) {
    return error(
      request,
      options,
      'too-large',
      `The request is larger than ${LIMITS.bodyBytes} bytes.`
    );
  }
  const admitted = admitRequest(body);
  if (!admitted.ok) return error(request, options, admitted.code, admitted.message);

  const controller = new AbortController();
  const events = options.service.draft(admitted.request, { ip, session }, controller.signal);

  if ((request.headers.get('accept') ?? '').includes('text/event-stream')) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>(
      {
        async pull(sink) {
          const next = await events.next();
          if (next.done) sink.close();
          else sink.enqueue(encoder.encode(sseFrame(next.value)));
        },
        async cancel() {
          controller.abort();
          await events.return(undefined);
        },
      },
      { highWaterMark: 0 }
    );
    return new Response(stream, {
      status: 200,
      headers: {
        ...BASE_HEADERS,
        ...corsHeaders(request, options),
        'content-type': 'text/event-stream; charset=utf-8',
      },
    });
  }

  for await (const event of events) {
    if (event.type === 'error') {
      // Close the stream so the service releases the session's slot.
      await events.return(undefined);
      return error(request, options, event.code, event.message, event.receipt);
    }
    if (event.type === 'result') {
      await events.return(undefined);
      return json(request, options, 200, event.result);
    }
  }
  return error(request, options, 'provider-error', 'The request ended without a result.');
}
