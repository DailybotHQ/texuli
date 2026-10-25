/**
 * Provider keys (agent-service design §7, `docs/key-store.md`). There is no
 * key in the repository and no real provider adapter yet. This module only
 * defines how a key would be held once a developer places one outside the
 * repository: it is wrapped as soon as it is read, so logging, `JSON.stringify`
 * or string interpolation print `[redacted]`, and only `reveal()` returns the
 * value, for the one provider call that needs it.
 *
 * Nothing here reads files or environment variables: the adapters pass in
 * what they read (the Node dev server: `~/.config/texuli/agent.json` and env;
 * the edge worker: env from the platform's secret store only).
 */

const REDACTED = '[redacted]';
const INSPECT = Symbol.for('nodejs.util.inspect.custom');

/** A secret that prints as `[redacted]` everywhere except `reveal()`. */
export interface Secret {
  reveal(): string;
  toString(): string;
  toJSON(): string;
}

export function createSecret(value: string): Secret {
  const secret = {
    reveal: () => value,
    toString: () => REDACTED,
    toJSON: () => REDACTED,
    [INSPECT]: () => REDACTED,
  };
  return Object.freeze(secret);
}

export function isSecret(value: unknown): value is Secret {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Secret).reveal === 'function' &&
    (value as Secret).toJSON() === REDACTED
  );
}

/** Longest key accepted; anything longer is treated as malformed. */
export const MAX_KEY_LENGTH = 512;
/** A provider id is a short lowercase name such as `xai`; never a key. */
const PROVIDER_ID = /^[a-z][a-z0-9-]{0,31}$/;

/** A key must be printable ASCII with no spaces, 8 to MAX_KEY_LENGTH characters. */
export function isWellFormedKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    value.length <= MAX_KEY_LENGTH &&
    /^[\x21-\x7e]+$/.test(value)
  );
}

export interface LocalProviderConfig {
  /** Provider id, e.g. `xai`. */
  id: string;
  key: Secret;
}

/**
 * Read the `provider` block of the local operator file:
 * `{ "provider": { "id": "xai", "key": "<placed by the developer>" } }`.
 * Returns `undefined` for a missing or malformed block; the key is wrapped
 * before it leaves this function.
 */
export function parseLocalProvider(value: unknown): LocalProviderConfig | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const { id, key } = value as { id?: unknown; key?: unknown };
  if (typeof id !== 'string' || !PROVIDER_ID.test(id) || !isWellFormedKey(key)) return undefined;
  return { id, key: createSecret(key) };
}

export type ProviderKeySource = 'env' | 'local-config' | 'none';

export interface ProviderKeyResolution {
  /** The wrapped key, or `null` when none was placed (the replay provider runs). */
  key: Secret | null;
  /** Provider id, from `AGENT_PROVIDER` or the local config; `null` without a key. */
  provider: string | null;
  source: ProviderKeySource;
  /** Settings that were present but rejected, by name only; never their values. */
  rejected: readonly string[];
}

export interface ProviderKeyInput {
  /** `AGENT_PROVIDER_KEY`, from the platform's secret store or the developer's shell. */
  envKey?: string | undefined;
  /** `AGENT_PROVIDER`, e.g. `xai`. */
  envProvider?: string | undefined;
  /** The parsed local operator file (Node dev adapter only). */
  local?: { provider?: LocalProviderConfig } | undefined;
}

/**
 * Resolve the provider key. The environment wins over the local file, so a
 * hosted worker's secret store always decides; the local file is a dev
 * convenience. Malformed settings are reported by name and ignored.
 */
export function resolveProviderKey(input: ProviderKeyInput): ProviderKeyResolution {
  const rejected: string[] = [];
  const envProvider =
    input.envProvider !== undefined && PROVIDER_ID.test(input.envProvider)
      ? input.envProvider
      : null;
  if (input.envProvider !== undefined && envProvider === null) rejected.push('AGENT_PROVIDER');
  if (input.envKey !== undefined && input.envKey !== '') {
    if (isWellFormedKey(input.envKey)) {
      return {
        key: createSecret(input.envKey),
        provider: envProvider ?? input.local?.provider?.id ?? null,
        source: 'env',
        rejected,
      };
    }
    rejected.push('AGENT_PROVIDER_KEY');
  }
  const local = input.local?.provider;
  if (local) {
    return { key: local.key, provider: envProvider ?? local.id, source: 'local-config', rejected };
  }
  return { key: null, provider: null, source: 'none', rejected };
}

/** What is safe to print about a key resolution: never the key. */
export function describeProviderKey(resolution: ProviderKeyResolution): string {
  if (resolution.key === null) {
    const note = resolution.rejected.length ? `; ignored ${resolution.rejected.join(', ')}` : '';
    return `provider key: none (replay provider)${note}`;
  }
  return `provider key: present for ${resolution.provider ?? 'an unnamed provider'} (${resolution.source}; no adapter uses it yet)`;
}

/** Replace every occurrence of each secret in `text`; for error messages and log lines. */
export function redactSecrets(
  text: string,
  secrets: readonly (Secret | null | undefined)[]
): string {
  let out = text;
  for (const secret of secrets) {
    const value = secret?.reveal();
    if (value) out = out.split(value).join(REDACTED);
  }
  return out;
}
