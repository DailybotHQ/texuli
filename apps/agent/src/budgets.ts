/**
 * Provider-reported token ceilings. These counters use fixed UTC-day windows;
 * no provider pricing API or currency conversion is involved.
 */

export interface TokenBudgetLimits {
  perSessionDailyTokens: number;
  globalDailyTokens: number;
}

export const DEFAULT_TOKEN_BUDGETS: TokenBudgetLimits = {
  perSessionDailyTokens: 100_000,
  globalDailyTokens: 1_000_000,
};

export interface TokenUsageTotals {
  sessionTokens: number;
  globalTokens: number;
}

/** Usage storage can be replaced by an atomic host store when one is selected. */
export interface TokenUsageStore {
  totals(session: string, dayStart: number): Promise<TokenUsageTotals>;
  add(session: string, dayStart: number, tokens: number): Promise<TokenUsageTotals>;
}

const MAX_CEILING = 1_000_000_000_000;

function isCeiling(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_CEILING
  );
}

/** Parse the direct JSON text used by `AGENT_TOKEN_BUDGETS`. */
export function parseTokenBudgetConfig(text: string | null | undefined): TokenBudgetLimits | null {
  if (typeof text !== 'string' || text.trim() === '') return null;
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (!isCeiling(record.perSessionDailyTokens) || !isCeiling(record.globalDailyTokens)) {
      return null;
    }
    return {
      perSessionDailyTokens: record.perSessionDailyTokens,
      globalDailyTokens: record.globalDailyTokens,
    };
  } catch {
    return null;
  }
}

/** Parse the nested `tokenBudgets` block from the local operator config text. */
export function parseLocalTokenBudgetConfig(
  text: string | null | undefined
): TokenBudgetLimits | null {
  if (typeof text !== 'string' || text.trim() === '') return null;
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const nested = (value as Record<string, unknown>).tokenBudgets;
    if (nested === null || typeof nested !== 'object' || Array.isArray(nested)) return null;
    const record = nested as Record<string, unknown>;
    if (!isCeiling(record.perSessionDailyTokens) || !isCeiling(record.globalDailyTokens)) {
      return null;
    }
    return {
      perSessionDailyTokens: record.perSessionDailyTokens,
      globalDailyTokens: record.globalDailyTokens,
    };
  } catch {
    return null;
  }
}

/** In-memory token totals, shared by every session using this service instance. */
export function createMemoryTokenUsageStore(): TokenUsageStore {
  const sessionCounts = new Map<string, number>();
  const globalCounts = new Map<number, number>();
  const sessionKey = (session: string, dayStart: number) => `${dayStart}:${session}`;
  const current = (session: string, dayStart: number): TokenUsageTotals => ({
    sessionTokens: sessionCounts.get(sessionKey(session, dayStart)) ?? 0,
    globalTokens: globalCounts.get(dayStart) ?? 0,
  });
  return {
    async totals(session, dayStart) {
      return current(session, dayStart);
    },
    async add(session, dayStart, tokens) {
      const key = sessionKey(session, dayStart);
      const safeTokens = Number.isSafeInteger(tokens) && tokens > 0 ? tokens : 0;
      sessionCounts.set(
        key,
        Math.min(Number.MAX_SAFE_INTEGER, (sessionCounts.get(key) ?? 0) + safeTokens)
      );
      globalCounts.set(
        dayStart,
        Math.min(Number.MAX_SAFE_INTEGER, (globalCounts.get(dayStart) ?? 0) + safeTokens)
      );
      return current(session, dayStart);
    },
  };
}
