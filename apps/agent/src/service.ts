import { checkCodeBlock } from '@texuli/blocks/code/engine';
import { checkDataBlock } from '@texuli/blocks/data/engine';
import { checkEmbedBlock } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock } from '@texuli/blocks/interactive/engine';
import { checkMapBlock } from '@texuli/blocks/map/engine';
import { checkMediaBlock } from '@texuli/blocks/media/engine';
import { checkStructureBlock } from '@texuli/blocks/structure/engine';
import { checkTextBlock } from '@texuli/blocks/text/engine';
import { validateCanvas } from '@texuli/canvas/model';
import type { Catalog } from '@texuli/catalog/build';
import type { BlueprintEnvelope } from '@texuli/catalog/envelope';
import { createEnvelope, createValidationReceipt } from '@texuli/catalog/envelope';
import { assertInertRoots } from '@texuli/catalog/render/hostile';
import {
  type CatalogTreeInput,
  type RenderCatalog,
  renderCatalogFromBuild,
} from '@texuli/catalog/render/renderer';
import {
  type DraftCanvasCheck,
  type DraftDocumentCheck,
  type DraftFormCheck,
  type DraftValidation,
  type ValidateDraftOptions,
  validateDraft,
} from '@texuli/catalog/validate';
import { createFamilyBlockCheck, diagramFamilyCheck } from '@texuli/catalog/validate/blocks';
import { validateDocument } from '@texuli/document/schema';
import { checkFormDraft } from '@texuli/forms/model';
import {
  createMemoryTokenUsageStore,
  DEFAULT_TOKEN_BUDGETS,
  type TokenBudgetLimits,
  type TokenUsageStore,
} from './budgets.ts';
import { createLeakGuard, LEAK_WINDOW, plainModelText, WITHHELD_NOTE } from './contain.ts';
import {
  type ActionReceipt,
  type AgentErrorCode,
  type AgentEvent,
  type DraftRequest,
  type DraftResult,
  type GuardReceipt,
  LIMITS,
  type Receipt,
} from './contract.ts';
import { createDraftStreamer, type DraftStreamEvent, type DraftStreamer } from './draft-stream.ts';
import {
  type ActionReceiptStore,
  createMemoryActionReceiptStore,
  createMemoryDraftStore,
  type DraftStore,
} from './drafts.ts';
import {
  type BreakerOptions,
  type BreakerSnapshot,
  type CircuitBreaker,
  createCircuitBreaker,
  type KillSwitchState,
} from './guard.ts';
import {
  type CounterStore,
  checkRateLimits,
  createMemoryCounterStore,
  DEFAULT_RATE_LIMITS,
  type RateLimits,
} from './limits.ts';
import { canonicalJson, type Provider, type ProviderMessage } from './provider.ts';
import { blueprintTool, systemPrompt, TOOL_NAME } from './tools.ts';

/**
 * The family parsers injected per `blocks-*` id (the catalog entry stays
 * under its 8 KiB budget because the engines are injected here).
 */
/**
 * The host document validator for `document` nodes: `validateDocument` from
 * `@texuli/document/schema` at the draft's tier (always `untrusted` here).
 * Warnings (orphaned comment anchors) do not refuse; every error does. The
 * same check runs for each streamed node and for the final `validateDraft`.
 */
export const checkDocumentDraft: DraftDocumentCheck = (doc, tier) => {
  const result = validateDocument(doc, { trust: tier });
  const issues = result.issues.map((issue) => ({
    code: issue.code,
    path: issue.jsonPath,
    message: issue.message,
    severity: issue.severity === 'warning' ? ('warning' as const) : ('error' as const),
  }));
  return result.ok ? { ok: true, document: result.document, issues } : { ok: false, issues };
};

/**
 * The host form validator for `schema-form` nodes (spec 0.8.0, ADR-015):
 * `checkFormDraft` from `@texuli/forms/model` (`validateFormSchema` at the
 * draft's tier, always `untrusted` here). The service knows no host
 * validators, so it does not restrict `validator` names: the host that
 * paints the draft checks them against its own (`@texuli/forms/host`
 * refuses a name it did not register). The same check runs for each
 * streamed node and for the final `validateDraft`.
 */
export const checkFormSchemaDraft: DraftFormCheck = (schema, tier, validators) =>
  checkFormDraft(schema, tier, validators);

/**
 * The host canvas validator for `canvas` nodes (spec 0.8.0, ADR-012):
 * `validateCanvas` from `@texuli/canvas/model` at the draft's tier, the
 * same check as `checkCanvasDraft` in `@texuli/canvas/host` without the
 * viewer's Svelte mount (the worker paints nothing). Warnings do not
 * refuse; every error does.
 */
export const checkCanvasSchemaDraft: DraftCanvasCheck = (canvas, tier) => {
  const result = validateCanvas(canvas, { trust: tier });
  const issues = result.issues.map((issue) => ({
    code: issue.code,
    path: issue.jsonPath,
    message: issue.message,
    severity: issue.severity === 'warning' ? ('warning' as const) : ('error' as const),
  }));
  return result.ok ? { ok: true, canvas: result.canvas, issues } : { ok: false, issues };
};

let familyEngines: ReturnType<typeof createFamilyBlockCheck> | undefined;
// The factory runs on first use instead of at module init: an init-time
// call made loading order-sensitive under transformed module graphs.
function checkFamilyBlock(block: unknown, id: string) {
  familyEngines ??= createFamilyBlockCheck({
    'blocks-code': checkCodeBlock,
    'blocks-data': checkDataBlock,
    'blocks-diagram': diagramFamilyCheck,
    'blocks-embed': checkEmbedBlock,
    'blocks-interactive': checkInteractiveBlock,
    'blocks-map': checkMapBlock,
    'blocks-media': checkMediaBlock,
    'blocks-structure': checkStructureBlock,
    'blocks-text': checkTextBlock,
  });
  return familyEngines(block, id);
}

export interface AgentConfig {
  /** The built catalog the service validates against and pins requests to. */
  catalog: Catalog;
  catalogHash: string;
  provider: Provider;
  /** Persists the final draft lifecycle and its host-computed validation receipt. */
  draftStore?: DraftStore;
  /** Persists privacy-safe action receipts partitioned by session. */
  actionReceiptStore?: ActionReceiptStore;
  /** Per-session and service-global daily ceilings in reported-token units. */
  tokenBudgets?: TokenBudgetLimits;
  /** Shared usage store; the default is shared by sessions within this service instance. */
  tokenUsageStore?: TokenUsageStore;
  /** The kill switch: when it returns false, every request gets `unavailable`. */
  enabled?: () => boolean;
  /**
   * The kill switch with the setting that decided it (env or local config);
   * used instead of `enabled` when given. Read before every provider call.
   */
  killSwitch?: () => KillSwitchState;
  /** A circuit breaker, or options for the default one, guarding provider calls. */
  breaker?: CircuitBreaker | BreakerOptions;
  rateLimits?: RateLimits;
  counters?: CounterStore;
  /** Milliseconds; injectable for tests. */
  clock?: () => number;
  newId?: () => string;
}

export interface Caller {
  ip: string;
  session: string;
}

export interface GuardStatus {
  killSwitch: KillSwitchState;
  breaker: BreakerSnapshot;
}

/** A guard refusal: the error code, its message and the receipt. */
export interface GuardRefusal {
  code: 'unavailable' | 'circuit-open';
  message: string;
  receipt: GuardReceipt;
}

export interface AgentService {
  readonly catalogHash: string;
  readonly enabled: boolean;
  /** Kill switch and breaker state, for health checks. */
  readonly guards: GuardStatus;
  /** The kill-switch refusal for a request arriving now, or `null` when the service is on. */
  admissionRefusal(): GuardRefusal | null;
  /** One request as a stream of events. Never throws; failures are `error` events. */
  draft(request: DraftRequest, caller: Caller, signal?: AbortSignal): AsyncGenerator<AgentEvent>;
  /** Action receipts for the caller's current session; receipts contain no session data. */
  receipts(session: string): Promise<readonly ActionReceipt[]>;
}

/** A provider `error` event, thrown inside the call loop so one path handles every failure. */
class ProviderStop extends Error {
  readonly retryable: boolean;
  constructor(retryable: boolean) {
    super('The provider stopped.');
    this.retryable = retryable;
  }
}

const MAX_NOTE = 500;
const MAX_REPAIR_DIAGNOSTICS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The platform-free agent service (agent-service design §3 to §8). It
 * re-validates any incoming draft, calls the model through the provider
 * seam with a bounded history, gates the output with the shared
 * `validateDraft` (untrusted tier, frame root, block schemas) plus the
 * inertness check, repairs at most `LIMITS.repairs` times, and returns a
 * validated draft with a receipt. It drafts only: there is no activate,
 * publish or send operation.
 */
export function createAgentService(config: AgentConfig): AgentService {
  const clock = config.clock ?? (() => Date.now());
  const newId = config.newId ?? (() => crypto.randomUUID());
  const counters = config.counters ?? createMemoryCounterStore();
  const draftStore = config.draftStore ?? createMemoryDraftStore();
  const actionReceiptStore = config.actionReceiptStore ?? createMemoryActionReceiptStore();
  const tokenBudgets = config.tokenBudgets ?? DEFAULT_TOKEN_BUDGETS;
  const tokenUsageStore = config.tokenUsageStore ?? createMemoryTokenUsageStore();
  const limits = config.rateLimits ?? DEFAULT_RATE_LIMITS;
  const renderCatalog: RenderCatalog = renderCatalogFromBuild(config.catalog);
  const tool = blueprintTool(config.catalog);
  const system = systemPrompt(config.catalog);
  // A hijacked model may try to relay the service's instructions; those replies are withheld.
  const leakGuard = createLeakGuard([system, tool.description]);
  const inFlight = new Set<string>();
  const killSwitch = (): KillSwitchState =>
    config.killSwitch?.() ?? { enabled: config.enabled?.() ?? true, source: 'default' };
  const enabled = () => killSwitch().enabled;
  const breaker: CircuitBreaker =
    config.breaker && 'allow' in config.breaker
      ? config.breaker
      : createCircuitBreaker({ clock, ...(config.breaker ?? {}) });

  const killed = (attempts: number): GuardRefusal | null => {
    const state = killSwitch();
    if (state.enabled) return null;
    return {
      code: 'unavailable',
      message: 'The agent is turned off right now.',
      receipt: {
        id: newId(),
        guard: 'kill-switch',
        catalogHash: config.catalogHash,
        at: new Date(clock()).toISOString(),
        source: state.source,
        attempts,
      },
    };
  };

  const tripped = (attempts: number): GuardRefusal | null => {
    const decision = breaker.allow();
    if (decision.ok) return null;
    const { state, failures, trips, retryAt } = breaker.snapshot();
    return {
      code: 'circuit-open',
      message: 'The model is failing right now; try again shortly.',
      receipt: {
        id: newId(),
        guard: 'circuit-breaker',
        catalogHash: config.catalogHash,
        at: new Date(clock()).toISOString(),
        breaker: { state, failures, trips, retryAt },
        retryAfterMs: decision.retryAfterMs,
        attempts,
      },
    };
  };

  const gateOptions: ValidateDraftOptions = {
    catalog: renderCatalog,
    tier: 'untrusted',
    catalogHash: config.catalogHash,
    checkBlock: (block, id) => checkFamilyBlock(block, id),
    // Documents (spec 0.7.0): without the host validator every `document` node is refused.
    checkDocument: checkDocumentDraft,
    // Forms and canvases (spec 0.8.0): checked by their engines' validators.
    checkForm: checkFormSchemaDraft,
    checkCanvas: checkCanvasSchemaDraft,
    // Data sources (spec 0.8.0): the service holds no source registry, so it
    // passes no `sources` and every `{"$source": …}` binding is refused, in
    // the stream and in the final validation alike (as in validateDraft).
  };
  const gate = (input: unknown): DraftValidation => validateDraft(input, gateOptions);

  const tokenBudgetRefusal = (
    requestId: string,
    totals: { sessionTokens: number; globalTokens: number },
    attempts: number,
    at: number,
    denyAtLimit = false,
    resetAt = (Math.floor(at / DAY_MS) + 1) * DAY_MS
  ): GuardReceipt | null => {
    const reached = (used: number, limit: number) => (denyAtLimit ? used >= limit : used > limit);
    const exceeded = reached(totals.sessionTokens, tokenBudgets.perSessionDailyTokens)
      ? {
          scope: 'session' as const,
          limit: tokenBudgets.perSessionDailyTokens,
          used: totals.sessionTokens,
        }
      : reached(totals.globalTokens, tokenBudgets.globalDailyTokens)
        ? {
            scope: 'global' as const,
            limit: tokenBudgets.globalDailyTokens,
            used: totals.globalTokens,
          }
        : null;
    if (!exceeded) return null;
    return {
      id: requestId,
      guard: 'token-budget',
      catalogHash: config.catalogHash,
      at: new Date(at).toISOString(),
      retryAfterMs: Math.max(0, resetAt - at),
      attempts,
      budget: { ...exceeded, unit: 'reported-token' },
    };
  };

  async function* draft(
    request: DraftRequest,
    caller: Caller,
    signal?: AbortSignal
  ): AsyncGenerator<AgentEvent> {
    const fail = (code: AgentErrorCode, message: string): AgentEvent[] => [
      { type: 'error', code, message },
      { type: 'done' },
    ];
    const refuse = (refusal: GuardRefusal): AgentEvent[] => [
      { type: 'error', code: refusal.code, message: refusal.message, receipt: refusal.receipt },
      { type: 'done' },
    ];
    const off = killed(0);
    if (off) {
      yield* refuse(off);
      return;
    }
    if (request.catalogHash !== config.catalogHash) {
      yield* fail('catalog-mismatch', 'Reload the page: the catalog changed.');
      return;
    }
    const verdict = await checkRateLimits(counters, limits, caller, clock());
    if (!verdict.ok) {
      yield* fail(verdict.code, verdict.message);
      return;
    }
    if (inFlight.has(caller.session)) {
      yield* fail('busy', 'One request at a time, please.');
      return;
    }
    inFlight.add(caller.session);
    // True while a provider call the breaker allowed has no verdict yet.
    let callOpen = false;
    const started = clock();
    const requestId = newId();
    try {
      yield { type: 'accepted', requestId };

      const budgetDay = Math.floor(started / DAY_MS) * DAY_MS;
      let existingUsage: { sessionTokens: number; globalTokens: number };
      try {
        existingUsage = await tokenUsageStore.totals(caller.session, budgetDay);
      } catch {
        yield* fail('unavailable', 'The token budget could not be checked; try again.');
        return;
      }
      const exhaustedAtAdmission = tokenBudgetRefusal(
        requestId,
        existingUsage,
        0,
        clock(),
        true,
        budgetDay + DAY_MS
      );
      if (exhaustedAtAdmission) {
        yield {
          type: 'error',
          code: 'rate-limited',
          message: 'The reported-token budget is exhausted; try again after the daily reset.',
          receipt: exhaustedAtAdmission,
        };
        yield { type: 'done' };
        return;
      }

      const messages: ProviderMessage[] = (request.history ?? []).map((turn) => ({
        role: turn.role,
        text: turn.text,
      }));
      if (request.draft !== undefined) {
        const current = gate(request.draft);
        if (!current.ok) {
          const codes = [...new Set(current.diagnostics.map((d) => d.code))].slice(0, 5);
          yield* fail('invalid-draft', `The current draft is not valid (${codes.join(', ')}).`);
          return;
        }
        messages.push({
          role: 'user',
          text: `The current draft:\n${JSON.stringify(current.draft)}`,
        });
      }
      messages.push({ role: 'user', text: request.prompt });

      let gateMs = 0;
      let attempts = 0;
      const usage = { inputTokens: 0, outputTokens: 0 };
      let note = '';
      let textCarry = '';
      let noteWithheld = false;
      const consumeModelText = (raw: string): string | null => {
        if (noteWithheld) return null;
        const plain = plainModelText(raw, MAX_NOTE, false);
        if (!plain) return null;
        const joined = textCarry + plain;
        if (leakGuard.leaks(joined)) {
          textCarry = '';
          noteWithheld = true;
          note = WITHHELD_NOTE;
          return WITHHELD_NOTE;
        }
        const safeLength = Math.max(0, joined.length - (LEAK_WINDOW - 1));
        const safe = joined.slice(0, safeLength);
        textCarry = joined.slice(safeLength);
        const remaining = Math.max(0, MAX_NOTE - note.length);
        const visible = [...safe].slice(0, remaining).join('');
        note += visible;
        return visible || null;
      };
      let tokenBudgetExceeded: GuardReceipt | null = null;
      let tokenUsageUnavailable = false;
      let validation: DraftValidation | null = null;
      let extraCodes: { code: string; path: string; message: string }[] = [];

      const streamMode = request.stream === true;
      const envelopeFor = (tree: unknown, at: string) =>
        createEnvelope({
          id: `draft-${requestId}`,
          catalog: config.catalogHash,
          generator: {
            kind: 'agent',
            name: 'texuli.com agent',
            model: config.provider.label,
          },
          tree: tree as CatalogTreeInput,
          at,
        });

      while (attempts <= LIMITS.repairs) {
        attempts += 1;
        let toolInput: unknown;
        let sawTool = false;
        let attemptText = '';
        // Streamed tool input (ADR-014): one call, parsed as it arrives and,
        // in stream mode, checked node by node and re-framed for clients.
        const attemptAt = new Date(clock()).toISOString();
        const { tree: _placeholder, ...header } = envelopeFor(null, attemptAt);
        let streamer: DraftStreamer | null = null;
        let streamCallId: string | null = null;
        let streamIssue: { code: string; message: string } | null = null;
        const relay = (events: readonly DraftStreamEvent[]): AgentEvent[] =>
          streamMode
            ? events.map((event): AgentEvent => {
                if (event.type === 'chunk') {
                  return { type: 'draft-chunk', attempt: attempts, text: event.text };
                }
                if (event.type === 'node-ready') {
                  const { path, streamId, id } = event;
                  return { type: 'node-ready', attempt: attempts, path, streamId, id };
                }
                const { path, reason, codes } = event;
                return { type: 'refused', attempt: attempts, path, reason, codes };
              })
            : [];
        const openStreamer = () =>
          createDraftStreamer({ header, validation: gateOptions, check: streamMode });
        // Hard stop: the kill switch and the breaker are checked before every
        // provider call, so turning the agent off also ends a repair loop.
        const stop = killed(attempts - 1) ?? tripped(attempts - 1);
        if (stop) {
          yield* refuse(stop);
          return;
        }
        callOpen = true;
        try {
          for await (const event of config.provider.generate({
            system,
            tools: [tool],
            messages,
            signal,
          })) {
            if (signal?.aborted) return;
            if (event.type === 'text' || event.type === 'text-delta') {
              const text = consumeModelText(event.text);
              if (noteWithheld) attemptText = WITHHELD_NOTE;
              else if (text) attemptText += text;
            } else if (
              event.type === 'tool' &&
              event.name === TOOL_NAME &&
              !sawTool &&
              streamer === null
            ) {
              sawTool = true;
              toolInput = event.input;
              if (streamMode) {
                // A whole call streams as one chunk, so clients see one shape.
                const whole = openStreamer();
                const text =
                  JSON.stringify(toolInput) === undefined ? '' : canonicalJson(toolInput);
                yield* relay(whole.write(text));
                yield* relay(whole.end().events);
              }
            } else if (
              event.type === 'tool-delta' &&
              event.name === TOOL_NAME &&
              !sawTool &&
              (streamCallId === null || streamCallId === event.callId)
            ) {
              streamCallId = event.callId;
              streamer ??= openStreamer();
              yield* relay(streamer.write(event.text));
            } else if (event.type === 'error') {
              throw new ProviderStop(event.retryable);
            } else if (event.type === 'usage') {
              const inputTokens = Number.isFinite(event.inputTokens)
                ? Math.max(0, Math.floor(event.inputTokens))
                : 0;
              const outputTokens = Number.isFinite(event.outputTokens)
                ? Math.max(0, Math.floor(event.outputTokens))
                : 0;
              usage.inputTokens += inputTokens;
              usage.outputTokens += outputTokens;
              let totals: { sessionTokens: number; globalTokens: number };
              try {
                totals = await tokenUsageStore.add(
                  caller.session,
                  budgetDay,
                  inputTokens + outputTokens
                );
              } catch {
                tokenUsageUnavailable = true;
                break;
              }
              tokenBudgetExceeded ??= tokenBudgetRefusal(
                requestId,
                totals,
                attempts,
                clock(),
                false,
                budgetDay + DAY_MS
              );
            }
          }
          if (streamer !== null && !sawTool) {
            const ended = streamer.end();
            yield* relay(ended.events);
            if (ended.issue) streamIssue = ended.issue;
            else {
              sawTool = true;
              toolInput = ended.input;
            }
          }
          if (textCarry && !noteWithheld) {
            const remaining = Math.max(0, MAX_NOTE - note.length);
            const tail = [...textCarry].slice(0, remaining).join('');
            textCarry = '';
            if (tail) {
              note += tail;
              attemptText += tail;
            }
          }
          if (attemptText) yield { type: 'generating', text: attemptText };
          callOpen = false;
          breaker.recordSuccess();
        } catch (cause) {
          callOpen = false;
          // A caller hanging up is not a provider failure.
          if (signal?.aborted) breaker.recordAbort();
          else breaker.recordFailure();
          // A thrown failure (a dropped connection, a timeout) may pass on a retry.
          const retryable = cause instanceof ProviderStop ? cause.retryable : true;
          yield {
            type: 'error',
            code: 'provider-error',
            message: 'The model could not answer; try again.',
            retryable,
          };
          yield { type: 'done' };
          return;
        }

        if (signal?.aborted) return;

        if (tokenUsageUnavailable) {
          yield* fail('unavailable', 'The token budget could not be recorded; try again.');
          return;
        }

        if (tokenBudgetExceeded) {
          yield {
            type: 'error',
            code: 'rate-limited',
            message: 'The reported-token budget is exhausted; try again after the daily reset.',
            receipt: tokenBudgetExceeded,
          };
          yield { type: 'done' };
          return;
        }

        yield { type: 'validating', attempt: attempts };
        const gateStart = clock();
        extraCodes = [];
        const tree =
          sawTool &&
          toolInput !== null &&
          typeof toolInput === 'object' &&
          !Array.isArray(toolInput)
            ? (toolInput as { tree?: unknown }).tree
            : undefined;
        if (streamIssue) {
          validation = null;
          extraCodes = [{ code: streamIssue.code, path: '', message: streamIssue.message }];
        } else if (tree === undefined) {
          validation = null;
          extraCodes = [{ code: 'no-tree', path: '', message: `Call ${TOOL_NAME} with { tree }.` }];
        } else {
          // In stream mode the envelope is the one clients were sent, header and all.
          const candidate = envelopeFor(
            tree,
            streamMode ? attemptAt : new Date(clock()).toISOString()
          );
          validation = gate(candidate);
          if (validation.ok) {
            for (const failure of assertInertRoots(validation.roots)) {
              extraCodes.push({ code: 'not-inert', path: '', message: failure });
            }
          }
        }
        gateMs += clock() - gateStart;
        const valid = validation?.ok === true && extraCodes.length === 0;
        if (valid || attempts > LIMITS.repairs) break;

        const diagnostics = [
          ...extraCodes,
          ...(validation?.diagnostics.filter((d) => d.severity === 'error') ?? []),
        ].slice(0, MAX_REPAIR_DIAGNOSTICS);
        yield {
          type: 'repairing',
          attempt: attempts,
          codes: [...new Set(diagnostics.map((d) => d.code))],
        };
        messages.push(
          { role: 'assistant', text: `${TOOL_NAME} call ${attempts}` },
          {
            role: 'tool',
            text: JSON.stringify({
              status: 'invalid',
              diagnostics: diagnostics.map(({ code, path, message }) => ({ code, path, message })),
            }),
          }
        );
      }

      const valid = validation?.ok === true && extraCodes.length === 0;
      const completedAt = clock();
      const durationMs = Math.max(0, completedAt - started);
      const actionReceipt: ActionReceipt = {
        id: requestId,
        artifactKind: valid ? 'blueprint-draft' : 'draft-attempt',
        catalogHash: config.catalogHash,
        tiers: { providerOutput: 'untrusted', validation: 'untrusted' },
        durationMs,
        at: new Date(completedAt).toISOString(),
        attempts,
      };
      const receipt: Receipt = {
        ...actionReceipt,
        checks: validation ? { ...validation.checks } : { input: 'fail' },
        model: config.provider.label,
        timing: { totalMs: durationMs, gateMs },
        usage,
      };
      const diagnostics = [
        ...extraCodes,
        ...(validation?.diagnostics ?? []).map(({ code, path, message }) => ({
          code,
          path,
          message,
        })),
      ];
      // The root rule guarantees one root; an array never reaches a valid result.
      const tree =
        valid && validation?.draft && !Array.isArray(validation.draft)
          ? (validation.draft as CatalogTreeInput)
          : undefined;
      const envelope: BlueprintEnvelope | undefined =
        valid && validation?.envelope ? validation.envelope : undefined;
      const validationReceipt =
        envelope && validation
          ? createValidationReceipt(validation, new Date(clock()).toISOString())
          : null;
      try {
        await actionReceiptStore.save(caller.session, actionReceipt);
        if (envelope && validationReceipt) {
          await draftStore.save({ envelope, validationReceipt });
        }
      } catch {
        yield* fail('unavailable', 'The draft could not be saved; please try again.');
        return;
      }
      const result: DraftResult = tree
        ? {
            status: 'valid',
            draft: tree,
            ...(envelope ? { envelope } : {}),
            diagnostics,
            receipt,
            note:
              note ||
              'Here is a validated draft. It stays a draft until you activate it in your own tool.',
          }
        : {
            status: 'invalid',
            ...(envelope ? { envelope } : {}),
            diagnostics,
            receipt,
            note: `I could not produce a valid draft (${[...new Set(diagnostics.map((d) => d.code))].slice(0, 5).join(', ')}).`,
          };
      yield streamMode ? { type: 'final', result } : { type: 'result', result };
      yield { type: 'done' };
    } finally {
      // The stream was closed mid-call (the client went away): no verdict.
      if (callOpen) breaker.recordAbort();
      inFlight.delete(caller.session);
    }
  }

  return {
    catalogHash: config.catalogHash,
    get enabled() {
      return enabled();
    },
    get guards() {
      return { killSwitch: killSwitch(), breaker: breaker.snapshot() };
    },
    admissionRefusal: () => killed(0),
    receipts: (session) => actionReceiptStore.list(session),
    draft,
  };
}
