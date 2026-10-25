/**
 * Per-user limits and anonymous sessions (agent-service design §8). The
 * counter store is injected: memory for dev and tests, the platform's
 * key-value store when hosted (a developer decision). The numbers are the
 * design's advisory defaults until the developer sets a budget.
 */

/** Counts hits per key in fixed windows. */
export interface CounterStore {
  /** Record one hit for `key` in the window starting at `windowStart`; return the window's count. */
  hit(key: string, windowStart: number, windowMs: number): Promise<number>;
}

/** An in-memory store (one process; resets on restart). */
export function createMemoryCounterStore(): CounterStore {
  const counts = new Map<string, { start: number; count: number }>();
  return {
    async hit(key, windowStart) {
      const current = counts.get(key);
      const next = current && current.start === windowStart ? current.count + 1 : 1;
      counts.set(key, { start: windowStart, count: next });
      return next;
    },
  };
}

export interface RateLimits {
  perSessionPerHour: number;
  perIpPerHour: number;
  perIpPerMinute: number;
  /** A global daily request ceiling, standing in for the spend ceiling. */
  perDay: number;
}

export const DEFAULT_RATE_LIMITS: RateLimits = {
  perSessionPerHour: 20,
  perIpPerHour: 60,
  perIpPerMinute: 5,
  perDay: 2000,
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type LimitVerdict =
  | { ok: true }
  | { ok: false; code: 'rate-limited' | 'unavailable'; message: string };

/** Count one request and say whether it may run. */
export async function checkRateLimits(
  store: CounterStore,
  limits: RateLimits,
  who: { ip: string; session: string },
  now: number
): Promise<LimitVerdict> {
  const window = (ms: number) => Math.floor(now / ms) * ms;
  const day = await store.hit('day', window(DAY), DAY);
  if (day > limits.perDay) {
    return {
      ok: false,
      code: 'unavailable',
      message: 'The daily budget is used up; try again tomorrow.',
    };
  }
  const checks: [string, number, number][] = [
    [`ip-minute:${who.ip}`, MINUTE, limits.perIpPerMinute],
    [`ip-hour:${who.ip}`, HOUR, limits.perIpPerHour],
    [`session-hour:${who.session}`, HOUR, limits.perSessionPerHour],
  ];
  for (const [key, ms, max] of checks) {
    if ((await store.hit(key, window(ms), ms)) > max) {
      return {
        ok: false,
        code: 'rate-limited',
        message: 'Too many requests; wait a little and try again.',
      };
    }
  }
  return { ok: true };
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

/** Default session lifetime: one hour. */
export const SESSION_TTL_MS = HOUR;
/** Minimum worker signing-secret size; operators should provide random bytes, not a passphrase. */
export const MIN_SESSION_SECRET_BYTES = 32;

export function isSessionSecretUsable(secret: string | undefined): secret is string {
  return (
    secret !== undefined && new TextEncoder().encode(secret).byteLength >= MIN_SESSION_SECRET_BYTES
  );
}

/**
 * Issue a signed, short-lived anonymous session token: no account and no
 * personal data, only a random id and an expiry (Web Crypto HMAC-SHA-256).
 */
export async function issueSession(
  secret: string,
  now: number,
  ttl = SESSION_TTL_MS
): Promise<string> {
  const payload = base64url(
    new TextEncoder().encode(JSON.stringify({ sid: crypto.randomUUID(), exp: now + ttl }))
  );
  return `${payload}.${base64url(await hmac(secret, payload))}`;
}

/** The session id of a valid, unexpired token, or `null`. Constant-time signature compare. */
export async function verifySession(
  token: string,
  secret: string,
  now: number
): Promise<string | null> {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const given = fromBase64url(signature);
  const expected = await hmac(secret, payload);
  if (!given || given.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= (given[i] ?? 0) ^ (expected[i] ?? 0);
  if (diff !== 0) return null;
  try {
    const bytes = fromBase64url(payload);
    const data = JSON.parse(new TextDecoder().decode(bytes ?? new Uint8Array())) as {
      sid?: unknown;
      exp?: unknown;
    };
    if (typeof data.sid !== 'string' || typeof data.exp !== 'number' || data.exp <= now)
      return null;
    return data.sid;
  } catch {
    return null;
  }
}
