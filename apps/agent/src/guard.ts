/**
 * Operational guards for the agent service (agent-service design §8): the
 * kill switch, which hard-stops every generation call, and a circuit breaker,
 * which stops calling a failing model provider for a cooldown. Both are
 * platform-free: the adapters (`src/node.ts`, `src/worker.ts`) supply the
 * environment and any local configuration; nothing here reads files or keys.
 */

import { parseLocalTokenBudgetConfig, type TokenBudgetLimits } from './budgets.ts';
import { type LocalProviderConfig, parseLocalProvider } from './keys.ts';

export type KillSwitchSource = 'env' | 'local-config' | 'default';

export interface KillSwitchState {
  /** `false` stops the service: no request reaches the provider. */
  enabled: boolean;
  /** Which setting decided. A local-config "off" wins over the environment. */
  source: KillSwitchSource;
}

/**
 * The local operator file, e.g. `~/.config/texuli/agent.json`, read only by
 * the Node dev adapter. `enabled` drives the kill switch (only `false`
 * matters), `provider` is the optional dev key block (`docs/key-store.md`),
 * and `tokenBudgets` supplies the token ceiling policy. Unknown fields are
 * ignored.
 */
export interface LocalAgentConfig {
  enabled?: boolean;
  provider?: LocalProviderConfig;
  tokenBudgets?: TokenBudgetLimits;
}

/** Parse the local config text; anything malformed counts as no config. */
export function parseLocalAgentConfig(text: string | null | undefined): LocalAgentConfig {
  if (typeof text !== 'string' || text.trim() === '') return {};
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
    const { enabled, provider } = value as { enabled?: unknown; provider?: unknown };
    const parsedProvider = parseLocalProvider(provider);
    const tokenBudgets = parseLocalTokenBudgetConfig(text);
    return {
      ...(typeof enabled === 'boolean' ? { enabled } : {}),
      ...(parsedProvider ? { provider: parsedProvider } : {}),
      ...(tokenBudgets ? { tokenBudgets } : {}),
    };
  } catch {
    return {};
  }
}

export interface KillSwitchInput {
  /** The environment flag, e.g. `AGENT_ENABLED`. */
  env?: string | undefined;
  /** How the environment flag reads as "on": `'1'` (edge worker) or "anything but `'0'`" (dev). */
  envMode?: 'on-when-1' | 'off-when-0';
  local?: LocalAgentConfig;
}

/**
 * Resolve the kill switch. Off always wins: a local `{ "enabled": false }`
 * stops the service whatever the environment says, so an operator can
 * hard-stop a running dev server by editing one file.
 */
export function resolveKillSwitch(input: KillSwitchInput): KillSwitchState {
  if (input.local?.enabled === false) return { enabled: false, source: 'local-config' };
  if (input.env !== undefined) {
    const enabled = input.envMode === 'on-when-1' ? input.env === '1' : input.env !== '0';
    return { enabled, source: 'env' };
  }
  if (input.envMode === 'on-when-1') return { enabled: false, source: 'default' };
  return { enabled: true, source: 'default' };
}

export type BreakerState = 'closed' | 'open' | 'half-open';

export interface BreakerOptions {
  /** Consecutive provider failures that trip the breaker (default 3). */
  failureThreshold?: number;
  /** Milliseconds the breaker stays open before one trial call (default 30,000). */
  cooldownMs?: number;
  clock?: () => number;
}

export interface BreakerSnapshot {
  state: BreakerState;
  /** Consecutive failures counted toward the threshold. */
  failures: number;
  failureThreshold: number;
  cooldownMs: number;
  /** Times the breaker has opened since the service started. */
  trips: number;
  /** When the breaker last opened (epoch ms), or `null`. */
  openedAt: number | null;
  /** When an open breaker lets one trial call through (epoch ms), or `null`. */
  retryAt: number | null;
}

export type BreakerDecision = { ok: true } | { ok: false; retryAfterMs: number };

export interface CircuitBreaker {
  /** Ask before a provider call. Open: refuse until the cooldown ends, then allow one trial. */
  allow(): BreakerDecision;
  recordSuccess(): void;
  recordFailure(): void;
  /** A call ended without a verdict (the caller hung up): free a half-open trial, change nothing else. */
  recordAbort(): void;
  snapshot(): BreakerSnapshot;
}

export const DEFAULT_BREAKER = { failureThreshold: 3, cooldownMs: 30_000 } as const;

/**
 * A three-state circuit breaker. Closed: calls flow and consecutive failures
 * are counted. At the threshold it opens: calls are refused for `cooldownMs`.
 * Then it goes half-open and lets exactly one trial call through: success
 * closes it, failure opens it again for another cooldown.
 */
export function createCircuitBreaker(options: BreakerOptions = {}): CircuitBreaker {
  const clock = options.clock ?? (() => Date.now());
  const failureThreshold =
    Number.isInteger(options.failureThreshold) && (options.failureThreshold as number) > 0
      ? (options.failureThreshold as number)
      : DEFAULT_BREAKER.failureThreshold;
  const cooldownMs =
    Number.isFinite(options.cooldownMs) && (options.cooldownMs as number) >= 0
      ? (options.cooldownMs as number)
      : DEFAULT_BREAKER.cooldownMs;
  let state: BreakerState = 'closed';
  let failures = 0;
  let trips = 0;
  let openedAt: number | null = null;
  let trialInFlight = false;

  const open = () => {
    state = 'open';
    openedAt = clock();
    trips += 1;
    trialInFlight = false;
  };

  return {
    allow() {
      if (state === 'open') {
        const retryAt = (openedAt ?? 0) + cooldownMs;
        const now = clock();
        if (now < retryAt) return { ok: false, retryAfterMs: retryAt - now };
        state = 'half-open';
      }
      if (state === 'half-open') {
        // One trial at a time; everyone else waits for its verdict.
        if (trialInFlight) return { ok: false, retryAfterMs: cooldownMs };
        trialInFlight = true;
      }
      return { ok: true };
    },
    recordSuccess() {
      state = 'closed';
      failures = 0;
      openedAt = null;
      trialInFlight = false;
    },
    recordAbort() {
      trialInFlight = false;
    },
    recordFailure() {
      if (state === 'half-open') {
        open();
        return;
      }
      failures += 1;
      if (state === 'closed' && failures >= failureThreshold) open();
    },
    snapshot() {
      return {
        state,
        failures,
        failureThreshold,
        cooldownMs,
        trips,
        openedAt,
        retryAt: state === 'open' && openedAt !== null ? openedAt + cooldownMs : null,
      };
    },
  };
}
