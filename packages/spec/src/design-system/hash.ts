/**
 * Canonical JSON, a synchronous SHA-256 and the design-system content hash
 * (ADR-021, ADR-032). Keys are sorted at every depth with no whitespace and
 * `undefined` dropped, so key order never changes a hash. No dependency and no
 * Web Crypto (which is asynchronous), so every caller stays synchronous and
 * framework-free. `@texuli/tokens/design-system` re-exports `canonicalJson` and
 * `sha256Hex` from here.
 *
 * `designSystemContentHash` and `libraryEntryContentHash` are the approval
 * hashes of ADR-032. They are not the compiler's `compiled.hash` or the
 * resolver's `resolved.hash`, which are cache keys over the resolved document.
 */

/** JSON with object keys sorted at every depth; `undefined` members are dropped. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  const members = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
  return `{${members.join(',')}}`;
}

const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** Lowercase hex SHA-256 of the UTF-8 bytes of `text` (FIPS 180-4). */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const length = bytes.length;
  const blocks = ((length + 9 + 63) >> 6) << 6;
  const data = new Uint8Array(blocks);
  data.set(bytes);
  data[length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(blocks - 8, Math.floor(length / 0x20000000));
  view.setUint32(blocks - 4, (length << 3) >>> 0);
  const h = Uint32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < blocks; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15] as number;
      const b = w[i - 2] as number;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, k] = h as unknown as number[];
    for (let i = 0; i < 64; i++) {
      const t1 =
        ((k as number) +
          (rotr(e as number, 6) ^ rotr(e as number, 11) ^ rotr(e as number, 25)) +
          (((e as number) & (f as number)) ^ (~(e as number) & (g as number))) +
          (K[i] as number) +
          (w[i] as number)) >>>
        0;
      const t2 =
        ((rotr(a as number, 2) ^ rotr(a as number, 13) ^ rotr(a as number, 22)) +
          (((a as number) & (b as number)) ^
            ((a as number) & (c as number)) ^
            ((b as number) & (c as number)))) >>>
        0;
      k = g;
      g = f;
      f = e;
      e = ((d as number) + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    const next = [a, b, c, d, e, f, g, k] as number[];
    for (let i = 0; i < 8; i++) h[i] = ((h[i] as number) + (next[i] as number)) >>> 0;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}

/** The fields an approval excludes from its own hash (ADR-032). */
export const APPROVAL_HASH_EXCLUDED = [
  'status',
  'approvedBy',
  'approvedAt',
  'contentHash',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `approval` without its excluded fields; dropped when nothing else is left. */
function withoutApprovalFields(approval: unknown): unknown {
  if (!isRecord(approval)) return approval;
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(approval))
    if (!(APPROVAL_HASH_EXCLUDED as readonly string[]).includes(key)) kept[key] = value;
  return Object.keys(kept).length > 0 ? kept : undefined;
}

/** A library entry as its hash sees it: its `approval` without the excluded fields. */
function entryForHash(entry: unknown): unknown {
  if (!isRecord(entry) || !Object.hasOwn(entry, 'approval')) return entry;
  return { ...entry, approval: withoutApprovalFields(entry.approval) };
}

/**
 * The content hash of a design-system document (ADR-032): lowercase hex
 * SHA-256 of the canonical JSON of the document without `approval.status`,
 * `approval.approvedBy`, `approval.approvedAt` and `approval.contentHash` (the
 * hash cannot cover itself). Library entries count without the same fields of
 * their own `approval`, so approving an entry never moves the document hash;
 * everything else, `approval.version` included, does.
 *
 * Pure and total over JSON values; it never mutates its input. It hashes the
 * document as written (call it before `extends` resolution: the approval
 * covers the file a reviewer approved).
 */
export function designSystemContentHash(doc: unknown): string {
  if (!isRecord(doc)) return sha256Hex(canonicalJson(doc));
  const view: Record<string, unknown> = { ...doc };
  if (Object.hasOwn(doc, 'approval')) view.approval = withoutApprovalFields(doc.approval);
  if (Array.isArray(doc.library)) view.library = doc.library.map(entryForHash);
  return sha256Hex(canonicalJson(view));
}

/**
 * The content hash of one library entry (ADR-032): lowercase hex SHA-256 of
 * the canonical JSON of the entry without `approval.status`,
 * `approval.approvedBy`, `approval.approvedAt` and `approval.contentHash`.
 */
export function libraryEntryContentHash(entry: unknown): string {
  return sha256Hex(canonicalJson(entryForHash(entry)));
}
