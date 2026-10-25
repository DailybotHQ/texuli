import type { BlueprintEnvelope, EnvelopeValidationReceipt } from '@texuli/catalog/envelope';
import type { ActionReceipt } from './contract.ts';

/** An agent-owned lifecycle snapshot. It records validation, never activation. */
export interface AgentDraftRecord {
  envelope: BlueprintEnvelope;
  validationReceipt: EnvelopeValidationReceipt;
}

/** Storage port for worker bindings or the local memory adapter. */
export interface DraftStore {
  save(record: AgentDraftRecord): Promise<void>;
}

/** Stores privacy-safe action receipts under a private session partition. */
export interface ActionReceiptStore {
  save(session: string, receipt: ActionReceipt): Promise<void>;
  list(session: string): Promise<readonly ActionReceipt[]>;
}

export interface MemoryDraftStore extends DraftStore {
  get(id: string): AgentDraftRecord | undefined;
}

/** A minimal KV binding surface, compatible with a worker key-value binding. */
export interface DraftKeyValueBinding {
  put(key: string, value: string): Promise<unknown>;
}

/** Minimal KV read surface used for per-session receipt retrieval. */
export interface ReceiptKeyValueBinding extends DraftKeyValueBinding {
  get(key: string): Promise<string | null>;
  list(options: { prefix: string }): Promise<{ keys: readonly { name: string }[] }>;
}

function copyActionReceipt(receipt: ActionReceipt): ActionReceipt {
  return {
    id: receipt.id,
    artifactKind: receipt.artifactKind,
    catalogHash: receipt.catalogHash,
    tiers: {
      providerOutput: receipt.tiers.providerOutput,
      validation: receipt.tiers.validation,
    },
    durationMs: receipt.durationMs,
    at: receipt.at,
    attempts: receipt.attempts,
  };
}

function parseActionReceipt(value: string): ActionReceipt | null {
  try {
    const parsed = JSON.parse(value) as Partial<ActionReceipt>;
    if (
      typeof parsed.id !== 'string' ||
      (parsed.artifactKind !== 'blueprint-draft' && parsed.artifactKind !== 'draft-attempt') ||
      typeof parsed.catalogHash !== 'string' ||
      typeof parsed.durationMs !== 'number' ||
      !Number.isFinite(parsed.durationMs) ||
      typeof parsed.at !== 'string' ||
      typeof parsed.attempts !== 'number' ||
      !Number.isInteger(parsed.attempts) ||
      parsed.tiers?.providerOutput !== 'untrusted' ||
      parsed.tiers?.validation !== 'untrusted'
    ) {
      return null;
    }
    return copyActionReceipt(parsed as ActionReceipt);
  } catch {
    return null;
  }
}

/** Local fallback; records live only as long as this worker process/isolate. */
export function createMemoryDraftStore(): MemoryDraftStore {
  const records = new Map<string, AgentDraftRecord>();
  return {
    async save(record) {
      records.set(record.envelope.id, record);
    },
    get(id) {
      return records.get(id);
    },
  };
}

/** Persist JSON lifecycle records through a host-provided KV binding. */
export function createKeyValueDraftStore(binding: DraftKeyValueBinding): DraftStore {
  return {
    async save(record) {
      await binding.put(record.envelope.id, JSON.stringify(record));
    },
  };
}

function receiptPrefix(session: string): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(session)).then((digest) => {
    const hash = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    return `agent:receipts:${hash}:`;
  });
}

/** Local fallback; receipt sessions live only as long as this worker isolate. */
export function createMemoryActionReceiptStore(): ActionReceiptStore {
  const receipts = new Map<string, ActionReceipt[]>();
  return {
    async save(session, receipt) {
      const current = receipts.get(session) ?? [];
      receipts.set(session, [...current, copyActionReceipt(receipt)]);
    },
    async list(session) {
      return (receipts.get(session) ?? []).map(copyActionReceipt);
    },
  };
}

/** KV-backed receipts are keyed by a one-way session hash, not caller data. */
export function createKeyValueActionReceiptStore(
  binding: ReceiptKeyValueBinding
): ActionReceiptStore {
  return {
    async save(session, receipt) {
      const prefix = await receiptPrefix(session);
      await binding.put(`${prefix}${receipt.id}`, JSON.stringify(copyActionReceipt(receipt)));
    },
    async list(session) {
      const prefix = await receiptPrefix(session);
      const { keys } = await binding.list({ prefix });
      const values = await Promise.all(keys.map(({ name }) => binding.get(name)));
      return values.flatMap((value) => {
        if (value === null) return [];
        const receipt = parseActionReceipt(value);
        return receipt ? [receipt] : [];
      });
    },
  };
}
