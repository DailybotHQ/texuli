import {
  createMemoryTokenUsageStore,
  parseTokenBudgetConfig,
  type TokenUsageStore,
} from './budgets.ts';
import { loadCatalog } from './catalog.ts';
import { createCspReportStore } from './csp-reports.ts';
import { DEMO_RECORDINGS } from './demo.ts';
import {
  createKeyValueActionReceiptStore,
  createKeyValueDraftStore,
  createMemoryActionReceiptStore,
  createMemoryDraftStore,
  type ReceiptKeyValueBinding,
} from './drafts.ts';
import { resolveKillSwitch } from './guard.ts';
import { handleRequest } from './http.ts';
import { type ProviderKeyResolution, resolveProviderKey } from './keys.ts';
import { createReplayProvider } from './provider.ts';
import { type AgentService, createAgentService } from './service.ts';

/**
 * The edge worker adapter: a standard `fetch` handler. Configuration comes
 * from the platform's environment; secrets only from its secret store.
 * There is no real provider: the fake replay adapter answers the preset
 * prompts. Deploying this is a developer GO.
 */
export interface WorkerEnv {
  /** The kill switch: anything but "1" turns the agent off. */
  AGENT_ENABLED?: string;
  AGENT_ALLOWED_ORIGIN?: string;
  /** From the platform's secret store; signs session tokens. */
  AGENT_SESSION_SECRET?: string;
  /**
   * From the platform's secret store only (docs/key-store.md); the worker never
   * reads a file. No adapter uses it yet: the replay provider answers.
   */
  AGENT_PROVIDER_KEY?: string;
  /** Provider id, e.g. `xai`. */
  AGENT_PROVIDER?: string;
  /** JSON text with per-session and global-daily provider-reported token ceilings. */
  AGENT_TOKEN_BUDGETS?: string;
  /** Optional host-shared atomic usage store; default usage is per worker isolate. */
  AGENT_TOKEN_USAGE?: TokenUsageStore;
  /** Optional worker KV binding for durable draft lifecycle records. */
  AGENT_DRAFTS?: ReceiptKeyValueBinding;
}

/** The worker's provider key: environment (secret store) only, never a file. */
export function workerProviderKey(env: WorkerEnv): ProviderKeyResolution {
  return resolveProviderKey({ envKey: env.AGENT_PROVIDER_KEY, envProvider: env.AGENT_PROVIDER });
}

let service: Promise<AgentService> | undefined;
/** Per-isolate CSP report counts; durable aggregation is planned (docs/csp-reports.md). */
const cspReports = createCspReportStore();
const memoryDraftStore = createMemoryDraftStore();
const memoryActionReceiptStore = createMemoryActionReceiptStore();
const memoryTokenUsageStore = createMemoryTokenUsageStore();

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    service ??= loadCatalog().then((build) =>
      createAgentService({
        catalog: build.catalog,
        catalogHash: build.hash,
        provider: createReplayProvider(DEMO_RECORDINGS),
        draftStore: env.AGENT_DRAFTS
          ? createKeyValueDraftStore(env.AGENT_DRAFTS)
          : memoryDraftStore,
        actionReceiptStore: env.AGENT_DRAFTS
          ? createKeyValueActionReceiptStore(env.AGENT_DRAFTS)
          : memoryActionReceiptStore,
        tokenUsageStore: env.AGENT_TOKEN_USAGE ?? memoryTokenUsageStore,
        tokenBudgets: parseTokenBudgetConfig(env.AGENT_TOKEN_BUDGETS) ?? undefined,
        killSwitch: () => resolveKillSwitch({ env: env.AGENT_ENABLED, envMode: 'on-when-1' }),
      })
    );
    return handleRequest(request, {
      service: await service,
      allowedOrigin: env.AGENT_ALLOWED_ORIGIN,
      sessionSecret: env.AGENT_SESSION_SECRET,
      requireSession: true,
      cspReports,
      ipOf: (r) => r.headers.get('cf-connecting-ip') ?? 'unknown',
    });
  },
};
