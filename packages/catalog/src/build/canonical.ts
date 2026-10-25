/**
 * Canonical JSON: object keys sorted, no whitespace, `undefined` fields
 * omitted. The same data always gives the same bytes, so the catalog can be
 * content-addressed. Values JSON cannot carry exactly are rejected rather
 * than silently changed.
 */
export function canonicalJson(value: unknown): string {
  return write(value, '$');
}

function write(value: unknown, path: string): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path}: ${value} is not JSON.`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => write(item === undefined ? null : item, `${path}[${index}]`)).join(',')}]`;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const fields = Object.entries(value as Record<string, unknown>)
      .filter(([, field]) => field !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, field]) => `${JSON.stringify(key)}:${write(field, `${path}.${key}`)}`);
    return `{${fields.join(',')}}`;
  }
  throw new TypeError(`${path}: ${typeof value} is not plain JSON data.`);
}

/** Lowercase hex SHA-256 of UTF-8 text (Web Crypto: browsers and Node). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
