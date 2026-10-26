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
 * agent, never an IP, never a referrer chain. The request the middleware
 * sends announces itself with the class in its own user-agent header, so
 * even the proxy's allowlisted UA forwarding cannot leak the original.
 */
import { isAgentRequest } from './agent-request.ts';
import { EVENTS } from './analytics.ts';

export type BotUaClass = 'ai_bot' | 'unknown_bot' | 'plain_agent' | 'audit_tool' | 'human';

export type BotEventName =
  | typeof EVENTS.AI_BOT_VISIT
  | typeof EVENTS.UNKNOWN_BOT_VISIT
  | typeof EVENTS.MARKDOWN_REQUEST;

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
      data: { path: pathname },
      // The class, never the raw UA: the header below matches it.
      userAgent: event === EVENTS.MARKDOWN_REQUEST ? 'markdown-client' : 'bot',
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
