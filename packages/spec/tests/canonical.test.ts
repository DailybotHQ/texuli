// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { canonicalJson, sha256 } from '../src/canonical.ts';
import { formatJson } from '../src/format.ts';

describe('sha256', () => {
  it('matches the FIPS 180-4 test vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
  });

  it('hashes UTF-8 bytes, across block boundaries', () => {
    // Two-, three- and four-byte UTF-8 sequences (reference: Node's crypto).
    expect(sha256('é漢字🙂')).toBe(
      'a4d09b21932f5c1f1dfb5d788e8e9e797dcb9a78ab5d4ce76803154078be0313'
    );
    expect(new Set(['x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64)].map(sha256)).size).toBe(3);
  });
});

describe('canonical JSON and the committed-file format', () => {
  it('sorts keys at every depth and drops undefined', () => {
    expect(canonicalJson({ b: [1, { d: 1, c: undefined }], a: 'x' })).toBe(
      '{"a":"x","b":[1,{"d":1}]}'
    );
  });

  it('refuses values JSON cannot carry exactly', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => canonicalJson(cycle)).toThrow(/cycle/);
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(/non-finite/);
    expect(() => canonicalJson({ f: () => 1 })).toThrow(/function/);
  });

  it('keeps short scalar arrays inline and expands objects, like the repository formatter', () => {
    expect(formatJson({ b: ['x', 'y'], a: { c: [] } })).toBe(
      '{\n  "a": {\n    "c": []\n  },\n  "b": ["x", "y"]\n}\n'
    );
    const long = Array.from({ length: 30 }, (_, i) => `item-${i}`);
    // `{`, the key line, 30 items, `]`, `}` and the final newline.
    expect(formatJson({ long }).split('\n').length).toBe(35);
  });
});
