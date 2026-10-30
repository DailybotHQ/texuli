/**
 * Server-side bot and markdown event decisions (T-37) — pure, unit-tested,
 * shared by the edge middleware. Where T-34's skip list decides which
 * clients must not load analytics, this module decides which automated
 * visits are *counted*: known AI crawlers (`ai_bot_visit`), unknown bot
 * heuristics (`unknown_bot_visit`) and served markdown twins
 * (`markdown_request`). Plain HTTP clients, audit tools and humans count
 * nothing.
 *
 * The emitted payload is UA-class + path shape only — never a raw user
 * agent, never an IP, never a referrer chain — and the path is scrubbed
 * and capped at 256 characters. The request the middleware
 * sends announces itself with the class in its own user-agent header, so
 * even the proxy's allowlisted UA forwarding cannot leak the original.
 */
import { isAgentRequest } from './agent-request.ts';
import { EVENTS, sanitizeEventData } from './analytics.ts';

export type BotUaClass = 'ai_bot' | 'unknown_bot' | 'plain_agent' | 'audit_tool' | 'human';

export type BotEventName =
  | typeof EVENTS.AI_BOT_VISIT
  | typeof EVENTS.UNKNOWN_BOT_VISIT
  | typeof EVENTS.MARKDOWN_REQUEST;

/** The counters-only event of the remote MCP endpoint (T-mcp-remote). */
export type McpEventName = typeof EVENTS.MCP_CALL;

/** Tokens naming known AI crawlers — the robots.txt AI list, lowercase. */
const AI_BOT_TOKENS = [
  'gptbot',
  'chatgpt-user',
  'claudebot',
  'anthropic-ai',
  'google-extended',
  'bytespider',
  'ccbot',
  'perplexitybot',
  'applebot-extended',
  'amazonbot',
  'meta-externalagent',
  'cohere-ai',
  'oai-searchbot',
  'deepseekbot',
  'claude-searchbot',
  'perplexity-user',
] as const;

/** Unknown-bot heuristic: crawler-shaped tokens outside the known lists. */
const UNKNOWN_BOT_RE = /bot|spider|crawl|slurp|monitor|preview|fetcher|scrape/;

/** Audit tools stay uncounted, exactly as they stay unserved analytics. */
const AUDIT_TOKENS = ['lighthouse'];

/** Which class of client is this, for analytics only? */
export function classifyBotUa(userAgent: string | null | undefined): BotUaClass {
  if (!userAgent) return 'human';
  const ua = userAgent.toLowerCase();
  if (AUDIT_TOKENS.some((token) => ua.includes(token))) return 'audit_tool';
  if (AI_BOT_TOKENS.some((token) => ua.includes(token))) return 'ai_bot';
  if (isAgentRequest(userAgent)) return 'plain_agent';
  if (UNKNOWN_BOT_RE.test(ua)) return 'unknown_bot';
  return 'human';
}

/**
 * The one event decision: a served markdown twin counts whatever fetched
 * it; a bot page hit counts by class; everything else counts nothing.
 */
export function botEventFor(
  userAgent: string | null | undefined,
  twinServed: boolean
): BotEventName | null {
  if (twinServed) return EVENTS.MARKDOWN_REQUEST;
  const uaClass = classifyBotUa(userAgent);
  if (uaClass === 'ai_bot') return EVENTS.AI_BOT_VISIT;
  if (uaClass === 'unknown_bot') return EVENTS.UNKNOWN_BOT_VISIT;
  return null;
}

/** The longest path an edge event carries. */
export const BOT_EVENT_PATH_MAX = 256;

/**
 * The path as an edge event may carry it: scrubbed of email-shaped values
 * by the client's own sanitizer, then capped at {@link BOT_EVENT_PATH_MAX}.
 * The scrub sees a bounded window first (a twice-the-cap slice), so an
 * attacker-length path costs a fixed amount of work and an address that
 * straddles the cap is still scrubbed whole.
 */
export function botEventPath(pathname: string): string {
  const head = pathname.slice(0, BOT_EVENT_PATH_MAX * 2);
  const scrubbed = sanitizeEventData({ path: head })?.path;
  return String(scrubbed ?? '').slice(0, BOT_EVENT_PATH_MAX);
}

/**
 * The edge event body for `/api/umami/api/send`: Umami's send shape with
 * UA-class + path only. Returns null when analytics is not provisioned —
 * the server-side off state mirrors the client's.
 */
export function buildBotEventBody(
  event: BotEventName,
  pathname: string,
  websiteId: string | undefined,
  hostname: string
): string | null {
  if (!websiteId) return null;
  return JSON.stringify({
    type: 'event',
    payload: {
      website: websiteId,
      name: event,
      hostname,
      data: { path: botEventPath(pathname) },
      // The class, never the raw UA: the header below matches it.
      userAgent: event === EVENTS.MARKDOWN_REQUEST ? 'markdown-client' : 'bot',
    },
  });
}

/** The duration buckets a remote MCP counter carries (never the exact time). */
export type McpDurationBucket = 'lt10ms' | 'lt100ms' | 'lt1s' | 'lt5s' | 'gte5s';

/** The bucket a measured duration falls into. */
export function mcpDurationBucket(milliseconds: number): McpDurationBucket {
  if (milliseconds < 10) return 'lt10ms';
  if (milliseconds < 100) return 'lt100ms';
  if (milliseconds < 1000) return 'lt1s';
  if (milliseconds < 5000) return 'lt5s';
  return 'gte5s';
}

/** The longest operation label a counter carries. */
const MCP_OPERATION_MAX = 64;

/**
 * The edge event body for one remote MCP request (`mcp_call`): the
 * operation label, the HTTP status and a duration bucket, nothing else —
 * never arguments, ids, the client IP or the user agent. The caller passes a
 * label from a closed list (a served tool or a known method, `batch` or
 * `unknown`); it is still capped here. Null when analytics is not
 * provisioned.
 */
export function buildMcpEventBody(
  counter: { operation: string; status: number; durationMs: number },
  websiteId: string | undefined,
  hostname: string
): string | null {
  if (!websiteId) return null;
  return JSON.stringify({
    type: 'event',
    payload: {
      website: websiteId,
      name: EVENTS.MCP_CALL,
      hostname,
      data: {
        operation: counter.operation.slice(0, MCP_OPERATION_MAX),
        status: counter.status,
        duration: mcpDurationBucket(counter.durationMs),
      },
      userAgent: 'mcp-client',
    },
  });
}

/**
 * The request the middleware sends for one counted event, through the
 * same-origin proxy path. Fire-and-forget by contract: the caller wraps
 * it in waitUntil and swallows failures.
 */
export function buildBotEventRequest(body: string, origin: string): Request {
  return new Request(`${origin}/api/umami/api/send`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'texuli-edge/1.0 (server-side event)',
    },
    body,
  });
}
