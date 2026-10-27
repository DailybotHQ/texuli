/**
 * Deterministic serialization and hashing, with no runtime dependency: the
 * same input gives the same bytes and digest in every runtime.
 */

/**
 * Canonical JSON: object keys sorted by UTF-16 code unit at every depth, no
 * whitespace, `undefined` fields dropped. Throws on values JSON cannot carry
 * exactly (functions, non-finite numbers, cycles).
 */
export function canonicalJson(value: unknown): string {
  return encode(value, new Set());
}

function encode(value: unknown, stack: Set<object>): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonicalJson: non-finite number');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new TypeError(`canonicalJson: ${typeof value} value`);
  if (stack.has(value)) throw new TypeError('canonicalJson: cycle');
  stack.add(value);
  let out: string;
  if (Array.isArray(value)) {
    out = `[${value.map((item) => encode(item === undefined ? null : item, stack)).join(',')}]`;
  } else {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    out = `{${keys.map((key) => `${JSON.stringify(key)}:${encode(record[key], stack)}`).join(',')}}`;
  }
  stack.delete(value);
  return out;
}

/**
 * Pretty canonical JSON for committed files: sorted keys, two-space indent,
 * a trailing newline. Byte-stable for the same data.
 */
export function prettyJson(value: unknown): string {
  return `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;
}

/**
 * The fractional part of `p`'s square (`n` 2) or cube (`n` 3) root as a
 * 32-bit word: the SHA-256 constants (FIPS 180-4 §4.2.2, §5.3.3). Newton
 * steps on plain IEEE arithmetic, which every runtime computes bit for bit
 * (`Math.cbrt` and `**` are only approximated); every word sits thousands
 * of ulps from a truncation boundary, and the test vectors cover all 72.
 */
function rootWord(p: number, n: 2 | 3): number {
  let x = 2;
  for (let i = 0; i < 40; i += 1) {
    x -= n === 2 ? (x * x - p) / (2 * x) : (x * x * x - p) / (3 * x * x);
  }
  return ((x - Math.floor(x)) * 0x100000000) >>> 0;
}

const PRIMES: number[] = [];
for (let n = 2; PRIMES.length < 64; n += 1) if (PRIMES.every((p) => n % p)) PRIMES.push(n);
const K = new Uint32Array(PRIMES.map((p) => rootWord(p, 3)));

/** UTF-8 bytes of a string (no `TextEncoder` needed). */
function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000)
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
  }
  return bytes;
}

/** Lowercase hex SHA-256 of a string's UTF-8 bytes (FIPS 180-4), synchronous. */
export function sha256(text: string): string {
  const bytes = utf8(text);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  for (const word of [high, bitLength >>> 0]) {
    bytes.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
  }
  const hash = new Uint32Array(PRIMES.slice(0, 8).map((p) => rootWord(p, 2)));
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const at = offset + i * 4;
      w[i] =
        ((bytes[at] ?? 0) << 24) |
        ((bytes[at + 1] ?? 0) << 16) |
        ((bytes[at + 2] ?? 0) << 8) |
        (bytes[at + 3] ?? 0);
    }
    for (let i = 16; i < 64; i += 1) {
      const a = w[i - 15] ?? 0;
      const b = w[i - 2] ?? 0;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash as unknown as number[];
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e as number, 6) ^ rotr(e as number, 11) ^ rotr(e as number, 25);
      const ch = ((e as number) & (f as number)) ^ (~(e as number) & (g as number));
      const t1 = ((h as number) + s1 + ch + (K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const s0 = rotr(a as number, 2) ^ rotr(a as number, 13) ^ rotr(a as number, 22);
      const maj =
        ((a as number) & (b as number)) ^
        ((a as number) & (c as number)) ^
        ((b as number) & (c as number));
      const t2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = ((d as number) + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    const round = [a, b, c, d, e, f, g, h] as number[];
    for (let i = 0; i < 8; i += 1) hash[i] = ((hash[i] ?? 0) + (round[i] ?? 0)) >>> 0;
  }
  return Array.from(hash, (word) => word.toString(16).padStart(8, '0')).join('');
}
