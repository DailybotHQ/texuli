/**
 * `@texuli/agent` — the texuli.com agent service (agent-service design):
 * a stateless worker that turns a prompt into a validated blueprint draft.
 * All logic is platform-free; the edge worker (`src/worker.ts`) and the
 * Node dev server (`src/node.ts`) are thin adapters. There is no activate,
 * publish or send endpoint.
 */

export {
  createMemoryTokenUsageStore,
  DEFAULT_TOKEN_BUDGETS,
  parseLocalTokenBudgetConfig,
  parseTokenBudgetConfig,
  type TokenBudgetLimits,
  type TokenUsageStore,
  type TokenUsageTotals,
} from './budgets.ts';
export { loadCatalog } from './catalog.ts';
export {
  type ActionReceipt,
  type AdmissionResult,
  AGENT_API_VERSION,
  type AgentErrorCode,
  type AgentEvent,
  admitRequest,
  type DraftRequest,
  type DraftResult,
  type GuardReceipt,
  type HistoryTurn,
  LIMITS,
  type Receipt,
  type StreamRefusalReason,
} from './contract.ts';
export {
  CSP_REPORT_TYPES,
  type CspReportParse,
  type CspReportSnapshot,
  type CspReportStore,
  type CspViolation,
  createCspReportStore,
  handleCspReport,
  MAX_CSP_REPORT_BYTES,
  MAX_REPORTS_PER_BODY,
  parseCspReports,
} from './csp-reports.ts';
export { DEMO_PROMPTS, DEMO_RECORDINGS } from './demo.ts';
export {
  createDraftStreamer,
  type DraftStreamEnd,
  type DraftStreamEvent,
  type DraftStreamer,
  type DraftStreamerOptions,
} from './draft-stream.ts';
export {
  type ActionReceiptStore,
  type AgentDraftRecord,
  createKeyValueActionReceiptStore,
  createKeyValueDraftStore,
  createMemoryActionReceiptStore,
  createMemoryDraftStore,
  type DraftKeyValueBinding,
  type DraftStore,
  type MemoryDraftStore,
  type ReceiptKeyValueBinding,
} from './drafts.ts';
export {
  type BreakerDecision,
  type BreakerOptions,
  type BreakerSnapshot,
  type BreakerState,
  type CircuitBreaker,
  createCircuitBreaker,
  DEFAULT_BREAKER,
  type KillSwitchInput,
  type KillSwitchSource,
  type KillSwitchState,
  type LocalAgentConfig,
  parseLocalAgentConfig,
  resolveKillSwitch,
} from './guard.ts';
export { type HttpOptions, handleRequest, sseFrame } from './http.ts';
export {
  createSecret,
  describeProviderKey,
  isSecret,
  isWellFormedKey,
  type LocalProviderConfig,
  MAX_KEY_LENGTH,
  type ProviderKeyInput,
  type ProviderKeyResolution,
  type ProviderKeySource,
  parseLocalProvider,
  redactSecrets,
  resolveProviderKey,
  type Secret,
} from './keys.ts';
export {
  type CounterStore,
  checkRateLimits,
  createMemoryCounterStore,
  DEFAULT_RATE_LIMITS,
  issueSession,
  type RateLimits,
  verifySession,
} from './limits.ts';
export {
  createNodeAgentSettings,
  type NodeAgentSettings,
  type NodeAgentSettingsInput,
} from './node-config.ts';
export {
  canonicalJson,
  chunkText,
  createFakeProvider,
  createReplayProvider,
  type FakeCall,
  type FakeProviderOptions,
  type InjectedOutcome,
  type Provider,
  type ProviderErrorCode,
  type ProviderEvent,
  type ProviderMessage,
  type ProviderRequest,
  type Recording,
} from './provider.ts';
export {
  ANTHROPIC_API_VERSION,
  ANTHROPIC_DEFAULT_BASE_URL,
  type AnthropicProviderOptions,
  anthropicRequestBody,
  createAnthropicProvider,
  toAnthropicMessages,
} from './providers/anthropic.ts';
export {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TIMEOUT_MS,
  type HttpProviderOptions,
} from './providers/http.ts';
export {
  chatRequestBody,
  createOpenAICompatibleProvider,
  OPENAI_DEFAULT_BASE_URL,
  type OpenAICompatibleProviderOptions,
  toChatMessages,
} from './providers/openai.ts';
export {
  createSseParser,
  readSse,
  SseLimitError,
  type SseMessage,
  type SseParser,
  type SseParserOptions,
} from './providers/sse.ts';
export {
  type AgentConfig,
  type AgentService,
  type Caller,
  createAgentService,
  type GuardRefusal,
  type GuardStatus,
} from './service.ts';
export { blueprintTool, systemPrompt, TOOL_NAME, tierUEntries } from './tools.ts';
