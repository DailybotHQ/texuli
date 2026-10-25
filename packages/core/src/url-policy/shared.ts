const URL_MAX_LENGTH = 4096;
const BLOCKED_SCHEMES = new Set(['javascript:', 'vbscript:', 'data:']);

export function cleanSource(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const source = value.trim();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: reject controls at URL sinks
  const hasUnsafeCharacters = /[\s\u0000-\u001f\u007f"'<>`\\]/.test(source);
  if (source.length === 0 || source.length > URL_MAX_LENGTH || hasUnsafeCharacters) {
    return undefined;
  }
  return source;
}

export function sourceScheme(value: string): string | undefined {
  return /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase();
}

export function isBlockedSource(value: string): boolean {
  const scheme = sourceScheme(value);
  return (
    (scheme !== undefined && BLOCKED_SCHEMES.has(`${scheme}:`)) ||
    value.startsWith('//') ||
    value.startsWith('\\')
  );
}

export function isAllowedRelativeOrWebSource(value: string): boolean {
  const scheme = sourceScheme(value);
  if (scheme === undefined) return !value.startsWith('#');
  if (scheme !== 'https' && scheme !== 'http') return false;
  try {
    const parsed = new URL(value);
    return parsed.username === '' && parsed.password === '';
  } catch {
    return false;
  }
}

export function isValidBlobSource(value: string): boolean {
  if (sourceScheme(value) !== 'blob') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'blob:' && parsed.origin !== 'null' && parsed.pathname.length > 1;
  } catch {
    return false;
  }
}

export function normalizedHttpsOrigins(origins: readonly string[] | undefined): Set<string> {
  const normalized = new Set<string>();
  if (!origins) return normalized;
  for (const origin of origins) {
    if (typeof origin !== 'string') continue;
    try {
      const parsed = new URL(origin);
      if (
        parsed.protocol === 'https:' &&
        parsed.origin === origin &&
        parsed.username === '' &&
        parsed.password === ''
      ) {
        normalized.add(parsed.origin);
      }
    } catch {
      // Invalid allowlist entries fail closed and cannot broaden the policy.
    }
  }
  return normalized;
}

export function isSafeDataImage(value: string): boolean {
  if (value.length > 1_400_000) return false;
  const match = /^data:image\/(?:png|jpeg|gif|webp|avif);base64,([a-z0-9+/]*={0,2})$/i.exec(value);
  const payload = match?.[1];
  if (!payload || payload.length % 4 !== 0) return false;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  const decodedBytes = (payload.length / 4) * 3 - padding;
  return decodedBytes <= MAX_DATA_IMAGE_BYTES;
}

/** Maximum decoded size of a developer-authored base64 data image. */
export const MAX_DATA_IMAGE_BYTES = 1024 * 1024;
