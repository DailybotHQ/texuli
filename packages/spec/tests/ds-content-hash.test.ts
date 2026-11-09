/**
 * ADR-032 content hash: `canonicalJson` + `sha256Hex` (moved from
 * `@texuli/tokens`) and `designSystemContentHash` / `libraryEntryContentHash`.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  APPROVAL_HASH_EXCLUDED,
  canonicalJson,
  type DesignSystem,
  designSystemContentHash,
  libraryEntryContentHash,
  sha256Hex,
  validateDesignSystem,
} from '../src/design-system/index.ts';

const nodeSha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('sha256Hex', () => {
  it('matches the published FIPS 180-2 / NIST test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
    expect(
      sha256Hex(
        'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu'
      )
    ).toBe('cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1');
    expect(sha256Hex('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'
    );
  });

  it('hashes the UTF-8 bytes, across every padding boundary', () => {
    for (const text of ['é', '€', '🧱', 'Pricing — card', '\u0000'])
      expect(sha256Hex(text)).toBe(nodeSha(text));
    for (let length = 50; length <= 130; length++) {
      const text = 'x'.repeat(length);
      expect(sha256Hex(text), String(length)).toBe(nodeSha(text));
    }
  });
});

describe('canonicalJson', () => {
  it('sorts keys at every depth, writes no whitespace and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: true, y: null }], c: 'x' }, u: undefined })).toBe(
      '{"a":{"c":"x","d":[3,{"y":null,"z":true}]},"b":1}'
    );
    expect(canonicalJson([1, 'two', null])).toBe('[1,"two",null]');
    expect(canonicalJson(Number.NaN)).toBe('null');
    expect(canonicalJson('quote " and \\')).toBe('"quote \\" and \\\\"');
  });
});

const doc: DesignSystem = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'harborline',
  version: '1.2.0',
  name: 'Harborline',
  color: { brand: { seed: '#0e7490' } },
  allow: { button: { variants: ['default', 'outline'], sizes: ['sm', 'md'] }, card: {} },
  library: [
    {
      id: 'pricing-card',
      name: 'Pricing card',
      purpose: 'One plan with its price and a call to action.',
      version: '0.3.0',
      status: 'approved',
      composes: ['card', 'button'],
      approval: {
        status: 'approved',
        approvedBy: 'Design reviewer',
        approvedAt: '2026-11-09T14:30:00Z',
        version: '0.3.0',
        contentHash: 'b'.repeat(64),
      },
    },
  ],
  approval: {
    status: 'approved',
    approvedBy: 'Design reviewer',
    approvedAt: '2026-11-09T15:00:00Z',
    version: '1.2.0',
    contentHash: 'a'.repeat(64),
  },
};

/** Deep copy with object keys reversed at every depth. */
function reversed(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reversed);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .reverse()
      .map(([key, child]) => [key, reversed(child)])
  );
}

const clone = <T>(value: T): T => structuredClone(value);

/** A deep-editable copy for the edit cases below (test-only). */
// biome-ignore lint/suspicious/noExplicitAny: the cases reach into nested fields to edit one value each
type Loose = Record<string, any>;

describe('designSystemContentHash', () => {
  it('is SHA-256 of the canonical JSON without the approval section (a pinned vector)', () => {
    const { approval: _approval, library, ...rest } = doc;
    const expected = nodeSha(
      canonicalJson({
        ...rest,
        library: library?.map(({ approval: _entryApproval, ...entry }) => entry),
      })
    );
    expect(designSystemContentHash(doc)).toBe(expected);
    expect(designSystemContentHash(doc)).toMatch(/^[0-9a-f]{64}$/);
    expect(
      validateDesignSystem({
        ...doc,
        approval: { ...doc.approval, contentHash: designSystemContentHash(doc) },
      }).ok
    ).toBe(true);
    expect(APPROVAL_HASH_EXCLUDED).toEqual(['approval']);
  });

  it('ignores key order at every depth', () => {
    expect(designSystemContentHash(reversed(doc))).toBe(designSystemContentHash(doc));
  });

  it('ignores the approval fields, of the document and of each library entry', () => {
    const hash = designSystemContentHash(doc);
    const draft = clone(doc) as Loose;
    draft.approval = { status: 'draft', version: '1.2.0' };
    expect(designSystemContentHash(draft)).toBe(hash);
    const other = clone(doc) as Loose;
    other.approval.approvedBy = 'Someone else';
    other.approval.approvedAt = '2027-01-01T00:00:00Z';
    other.approval.contentHash = 'c'.repeat(64);
    other.library[0].approval = { status: 'draft', version: '0.3.0' };
    expect(designSystemContentHash(other)).toBe(hash);
    // A document whose approval holds only excluded fields hashes like one without approval.
    const { approval: _a, ...bare } = doc;
    const onlyStatus = { ...bare, approval: { status: 'draft' } };
    expect(designSystemContentHash(onlyStatus)).toBe(designSystemContentHash(bare));
  });

  it('changes when any other field changes', () => {
    const hash = designSystemContentHash(doc);
    const edits: [string, (d: Loose) => void][] = [
      [
        'version',
        (d) => {
          d.version = '1.2.1';
        },
      ],
      [
        'name',
        (d) => {
          d.name = 'Harborline 2';
        },
      ],
      [
        'a color',
        (d) => {
          d.color.brand.seed = '#0e7491';
        },
      ],
      [
        'an allowed variant',
        (d) => {
          d.allow.button.variants.push('ghost');
        },
      ],
      [
        'allowed variant order',
        (d) => {
          d.allow.button.variants.reverse();
        },
      ],
      [
        'an allowed component',
        (d) => {
          d.allow.badge = {};
        },
      ],
      [
        'a library entry',
        (d) => {
          d.library[0].purpose = 'Changed.';
        },
      ],
      [
        'a library entry status',
        (d) => {
          d.library[0].status = 'draft';
        },
      ],
      [
        'a new section',
        (d) => {
          d.voice = { tone: ['calm'] };
        },
      ],
    ];
    const seen = new Set([hash]);
    for (const [name, edit] of edits) {
      const changed = clone(doc) as Loose;
      edit(changed);
      const next = designSystemContentHash(changed);
      expect(next, name).not.toBe(hash);
      seen.add(next);
    }
    expect(seen.size).toBe(edits.length + 1);
  });

  it('never mutates its input and is total over JSON values', () => {
    const copy = clone(doc);
    designSystemContentHash(copy);
    expect(copy).toEqual(doc);
    for (const value of [null, 1, 'x', [], {}, { approval: 'not an object' }, { library: 'nope' }])
      expect(designSystemContentHash(value)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('libraryEntryContentHash', () => {
  const entry = doc.library?.[0] as NonNullable<DesignSystem['library']>[number];

  it('is SHA-256 of the canonical JSON of the entry without its approval', () => {
    const { approval: _approval, ...rest } = entry;
    expect(libraryEntryContentHash(entry)).toBe(nodeSha(canonicalJson(rest)));
    expect(libraryEntryContentHash(reversed(entry))).toBe(libraryEntryContentHash(entry));
  });

  it('ignores approval status, who, when and hash, and changes with anything else', () => {
    const hash = libraryEntryContentHash(entry);
    expect(
      libraryEntryContentHash({ ...entry, approval: { status: 'draft', version: '0.3.0' } })
    ).toBe(hash);
    const { approval: _a, ...noApproval } = entry;
    expect(libraryEntryContentHash({ ...noApproval, approval: { status: 'draft' } })).toBe(
      libraryEntryContentHash(noApproval)
    );
    expect(libraryEntryContentHash({ ...entry, composes: ['card'] })).not.toBe(hash);
    expect(libraryEntryContentHash({ ...entry, version: '0.3.1' })).not.toBe(hash);
    expect(libraryEntryContentHash({ ...entry, status: 'draft' })).not.toBe(hash);
  });
});
