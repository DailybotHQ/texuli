import type { TokenBudgetLimits, TokenUsageStore } from '../src/budgets.ts';
import { loadCatalog } from '../src/catalog.ts';
import type { AgentEvent, DraftRequest } from '../src/contract.ts';
import { DEMO_RECORDINGS } from '../src/demo.ts';
import type { ActionReceiptStore, DraftStore } from '../src/drafts.ts';
import { createMemoryCounterStore, type RateLimits } from '../src/limits.ts';
import { createReplayProvider, type Provider, type Recording } from '../src/provider.ts';
import { type AgentConfig, createAgentService } from '../src/service.ts';

export const build = await loadCatalog();
export const HASH = build.hash;

export function service(
  options: Partial<AgentConfig> & {
    recordings?: readonly Recording[];
    provider?: Provider;
    draftStore?: DraftStore;
    actionReceiptStore?: ActionReceiptStore;
    tokenBudgets?: TokenBudgetLimits;
    tokenUsageStore?: TokenUsageStore;
  } = {}
) {
  return createAgentService({
    catalog: build.catalog,
    catalogHash: HASH,
    provider: options.provider ?? createReplayProvider(options.recordings ?? DEMO_RECORDINGS),
    counters: options.counters ?? createMemoryCounterStore(),
    ...(options.rateLimits ? { rateLimits: options.rateLimits as RateLimits } : {}),
    ...(options.enabled ? { enabled: options.enabled } : {}),
    ...(options.killSwitch ? { killSwitch: options.killSwitch } : {}),
    ...(options.breaker ? { breaker: options.breaker } : {}),
    ...(options.clock ? { clock: options.clock } : {}),
    ...(options.draftStore ? { draftStore: options.draftStore } : {}),
    ...(options.actionReceiptStore ? { actionReceiptStore: options.actionReceiptStore } : {}),
    ...(options.tokenBudgets ? { tokenBudgets: options.tokenBudgets } : {}),
    ...(options.tokenUsageStore ? { tokenUsageStore: options.tokenUsageStore } : {}),
    newId: options.newId ?? (() => 'req-1'),
  });
}

export async function collect(events: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

export const request = (prompt: string, extra: Partial<DraftRequest> = {}): DraftRequest => ({
  prompt,
  catalogHash: HASH,
  ...extra,
});

export const caller = { ip: '203.0.113.7', session: 'sid:test' };

export const toolCall = (tree: unknown) => ({
  type: 'tool' as const,
  name: 'emit_blueprint',
  input: { tree },
});
