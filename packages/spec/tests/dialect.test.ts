// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkSchemaDocument, DIALECT_URI, type Schema, validateInstance } from '../src/dialect.ts';
import { json, normative } from './helpers.ts';

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

describe('the closed dialect', () => {
  it('accepts every committed schema', () => {
    const schemas = Object.keys(normative).filter((p) => p.startsWith('schemas/'));
    expect(schemas).toHaveLength(4);
    for (const path of schemas) expect(checkSchemaDocument(json(path)), path).toEqual([]);
  });

  it('refuses unsupported keywords, open objects, bad refs and other dialects', () => {
    const base = { $schema: DIALECT_URI };
    expect(codes(checkSchemaDocument({ ...base, type: 'string', format: 'email' }))).toEqual([
      'unsupported-keyword',
    ]);
    expect(codes(checkSchemaDocument({ ...base, oneOf: [] }))).toEqual(['unsupported-keyword']);
    expect(codes(checkSchemaDocument({ ...base, type: 'object', properties: {} }))).toEqual([
      'open-object',
    ]);
    expect(codes(checkSchemaDocument({ ...base, $ref: 'https://example.com/x.json' }))).toEqual([
      'bad-ref',
    ]);
    expect(
      codes(checkSchemaDocument({ $schema: 'http://json-schema.org/draft-07/schema#' }))
    ).toEqual(['dialect']);
    expect(
      codes(
        checkSchemaDocument({
          ...base,
          type: 'object',
          properties: { a: {} },
          required: ['b'],
          additionalProperties: false,
        })
      )
    ).toEqual(['bad-required']);
  });
});

describe('validateInstance', () => {
  const schema: Schema = {
    type: 'object',
    properties: {
      id: { type: 'string', pattern: '^[a-z]+$', maxLength: 5 },
      count: { type: 'integer', minimum: 0 },
      tags: { type: 'array', maxItems: 2, items: { $ref: '#/$defs/tag' } },
      meta: { type: 'object', additionalProperties: { type: 'boolean' } },
    },
    required: ['id'],
    additionalProperties: false,
    $defs: { tag: { type: 'string', enum: ['a', 'b'] } },
  };

  it('passes a valid value and reports every problem with its path', () => {
    expect(
      validateInstance(schema, { id: 'abc', count: 2, tags: ['a'], meta: { x: true } })
    ).toEqual([]);
    const issues = validateInstance(schema, {
      id: 'ABCDEFG',
      count: 1.5,
      tags: ['c'],
      meta: { x: 'yes' },
      extra: 1,
    });
    expect(issues.map((i) => `${i.path} ${i.code}`)).toEqual([
      '$.id max-length',
      '$.id pattern',
      '$.count type',
      '$.tags[0] enum',
      '$.meta.x type',
      '$.extra additional-property',
    ]);
    expect(codes(validateInstance(schema, {}))).toEqual(['required']);
    expect(codes(validateInstance(schema, { id: 'a', tags: ['a', 'b', 'a'] }))).toEqual([
      'max-items',
    ]);
  });

  it('treats a parsed __proto__ key as an ordinary refused field', () => {
    const value = JSON.parse('{"id":"a","__proto__":{"admin":true}}');
    expect(codes(validateInstance(schema, value))).toEqual(['additional-property']);
  });
});
