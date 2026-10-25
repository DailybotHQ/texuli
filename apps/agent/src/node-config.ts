import {
  DEFAULT_TOKEN_BUDGETS,
  parseTokenBudgetConfig,
  type TokenBudgetLimits,
} from './budgets.ts';
import {
  type KillSwitchState,
  type LocalAgentConfig,
  parseLocalAgentConfig,
  resolveKillSwitch,
} from './guard.ts';
import { type ProviderKeyResolution, resolveProviderKey } from './keys.ts';

/**
 * The Node dev adapter's settings, separated from `src/node.ts` so tests can
 * drive them with config TEXT and a fake environment, never a real file.
 * `node.ts` passes `readConfigText` that reads the operator file
 * (`AGENT_LOCAL_CONFIG`, default `~/.config/texuli/agent.json`); this module
 * itself reads nothing.
 */

export interface NodeAgentSettingsInput {
  env: Readonly<Record<string, string | undefined>>;
  /** Returns the operator file's text, or `null` when it is missing. */
  readConfigText: () => string | null;
  /** Re-read the file at most this often (default 1,000 ms), so a toggle lands quickly. */
  refreshMs?: number;
  clock?: () => number;
}

export interface NodeAgentSettings {
  killSwitch(): KillSwitchState;
  providerKey(): ProviderKeyResolution;
  tokenBudgets(): TokenBudgetLimits;
}

export function createNodeAgentSettings(input: NodeAgentSettingsInput): NodeAgentSettings {
  const clock = input.clock ?? (() => Date.now());
  const refreshMs = input.refreshMs ?? 1_000;
  let cached: { at: number; value: LocalAgentConfig } | null = null;

  const local = (): LocalAgentConfig => {
    const now = clock();
    if (cached && now - cached.at < refreshMs) return cached.value;
    let text: string | null;
    try {
      text = input.readConfigText();
    } catch {
      text = null;
    }
    cached = { at: now, value: parseLocalAgentConfig(text) };
    return cached.value;
  };

  return {
    killSwitch: () =>
      resolveKillSwitch({ env: input.env.AGENT_ENABLED, envMode: 'off-when-0', local: local() }),
    providerKey: () =>
      resolveProviderKey({
        envKey: input.env.AGENT_PROVIDER_KEY,
        envProvider: input.env.AGENT_PROVIDER,
        local: local(),
      }),
    tokenBudgets: () =>
      parseTokenBudgetConfig(input.env.AGENT_TOKEN_BUDGETS) ??
      local().tokenBudgets ??
      DEFAULT_TOKEN_BUDGETS,
  };
}
