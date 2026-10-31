// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { writeDocx } from '../src/docx/index.ts';
import { documentFromMarkdown, documentToMarkdown } from '../src/markdown/index.ts';
import type { TexuliDocument } from '../src/model/types.ts';
import { writePdf } from '../src/pdf/index.ts';
import {
  DESIGN_SYSTEM_REF_PATTERN,
  documentJsonSchema,
  validateDocument,
} from '../src/schema/index.ts';
import { everyBlock } from './fixtures.ts';

/**
 * Spec 0.10.0 (ADR-024, T-ds-blueprint): a document may name the design
 * system it follows, `{ ref }` or `{ inline }`. This L1 engine checks the
 * shape, the ref grammar (the blueprint's) and bounded, safe JSON; the
 * reader validates and compiles the inline document before it paints.
 */
const minimal = JSON.parse(
  readFileSync(new URL('../../spec/fixtures/design-systems/minimal.json', import.meta.url), 'utf8')
) as Record<string, unknown>;
const issues = (designSystem: unknown, trust: 'developer' | 'untrusted' = 'untrusted') =>
  validateDocument({ ...everyBlock(), designSystem }, { trust }).issues.map(
    (i) => `${i.code} ${i.jsonPath}`
  );

describe('documents carry a design system (spec 0.10.0)', () => {
  it('accepts a reference or an inline document', () => {
    for (const value of [{ ref: 'acme@2.1.0' }, { ref: 'texuli:violet' }, { inline: minimal }])
      expect(issues(value), JSON.stringify(value)).toEqual([]);
    const result = validateDocument({ ...everyBlock(), designSystem: { inline: minimal } });
    expect(result.ok && result.document.designSystem).toEqual({ inline: minimal });
  });

  it('refuses ranges, URLs, both or neither, extra keys, hostile text and huge values', () => {
    for (const [value, expected] of [
      [{ ref: 'acme@^2' }, 'pattern $.designSystem.ref'],
      [{ ref: 'https://cdn.example/acme.json' }, 'pattern $.designSystem.ref'],
      [{ ref: 'acme@1.0.0', inline: minimal }, 'invalid-value $.designSystem'],
      [{}, 'invalid-value $.designSystem'],
      [{ ref: 'acme@1.0.0', css: ':root{}' }, 'unknown-key $.designSystem.css'],
      [{ inline: [] }, '$.designSystem.inline'],
      [
        { inline: { ...minimal, name: `Ac${String.fromCodePoint(0x202e)}me` } },
        'unsafe-text $.designSystem.inline.name',
      ],
      [
        { inline: { ...minimal, tags: Array.from({ length: 65 }, (_, i) => `t${i}`) } },
        '$.designSystem.inline.tags',
      ],
    ] as const) {
      expect(issues(value).join(' | '), JSON.stringify(value).slice(0, 60)).toContain(expected);
    }
    let deep: Record<string, unknown> = {};
    for (let i = 0; i < 40; i += 1) deep = { nest: deep };
    expect(issues({ inline: { ...minimal, voice: deep } }).join(' ')).toContain('$.designSystem');
    // A prototype key stays an own property and is refused, never merged.
    const parsed = JSON.parse('{"inline":{"__proto__":{"polluted":true}}}');
    expect(issues(parsed).length).toBeGreaterThan(0);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('shares the blueprint grammar and exports it in the JSON Schema', () => {
    const blueprint = JSON.parse(
      readFileSync(new URL('../../spec/schemas/blueprint.schema.json', import.meta.url), 'utf8')
    );
    expect(DESIGN_SYSTEM_REF_PATTERN.source).toBe(
      blueprint.$defs.designSystemReference.properties.ref.pattern
    );
    const schema = documentJsonSchema() as { properties: Record<string, { properties?: object }> };
    expect(Object.keys(schema.properties.designSystem?.properties ?? {})).toEqual([
      'ref',
      'inline',
    ]);
  });
});

describe('the writers carry a document design system (ADR-024)', () => {
  const core = (designSystem?: unknown): TexuliDocument =>
    ({
      format: 'texuli-document',
      formatVersion: 1,
      meta: { title: 'Field notes' },
      blocks: [
        {
          id: 'h',
          type: 'heading',
          level: 1,
          content: [{ type: 'text', text: 'Notes', marks: [] }],
        },
        { id: 'p', type: 'paragraph', content: [{ type: 'text', text: 'Calm seas.', marks: [] }] },
      ],
      ...(designSystem === undefined ? {} : { designSystem }),
    }) as TexuliDocument;

  it('round-trips a ref and an inline document through Markdown front matter, losslessly', () => {
    for (const designSystem of [
      { ref: 'acme@2.1.0' },
      { ref: 'texuli:violet' },
      { inline: minimal },
    ]) {
      const written = documentToMarkdown(core(designSystem));
      expect(written.startsWith('---\ndesignSystem: '), written.slice(0, 60)).toBe(true);
      expect(written.split('\n')[2]).toBe('---');
      const back = documentFromMarkdown(written);
      if (!back.ok) throw new Error(JSON.stringify(back.issues));
      expect(back.document.designSystem).toEqual(designSystem);
      expect(back.document.blocks.map((block) => block.type)).toEqual(['heading', 'paragraph']);
      // Written again, byte for byte.
      expect(documentToMarkdown(back.document)).toBe(written);
    }
    expect(documentToMarkdown(core({ ref: 'acme@2.1.0' }))).toContain(
      '---\ndesignSystem: acme@2.1.0\n---\n\n# Notes'
    );
    // Without one, no front matter: the output is unchanged.
    expect(documentToMarkdown(core())).toBe('# Notes\n\nCalm seas.');
  });

  it('reads only the exact front matter, and validates what it reads', () => {
    // A leading divider stays a divider.
    const divider = documentFromMarkdown('---\n\nText\n\n---\n');
    expect(divider.ok && divider.document.designSystem).toBe(undefined);
    expect(divider.ok && divider.document.blocks[0]?.type).toBe('divider');
    const other = documentFromMarkdown('---\ntitle: x\n---\n\nText');
    expect(other.ok && other.document.designSystem).toBe(undefined);
    // A ref outside the grammar, or JSON naming both keys, is refused with the schema's path.
    for (const value of [
      'acme@^2',
      'https://example.com/ds.json',
      '{"ref":"a@1.0.0","inline":{}}',
    ]) {
      const read = documentFromMarkdown(`---\ndesignSystem: ${value}\n---\n\nText`);
      expect(read.ok, value).toBe(false);
      if (!read.ok) expect(read.issues[0]?.jsonPath, value).toMatch(/^\$\.designSystem/);
    }
    // JSON that does not parse is not front matter.
    const broken = documentFromMarkdown('---\ndesignSystem: {nope\n---\n\nText');
    expect(broken.ok && broken.document.designSystem).toBe(undefined);
  });

  it('DOCX and PDF report a design system they were not given values for, and apply the values when given', async () => {
    const design = { colors: { foreground: '#123456' } };
    for (const write of [writeDocx, writePdf] as const) {
      const named = await write(core({ ref: 'acme@2.1.0' }), { compress: false });
      expect(named.diagnostics.map((d) => d.code)).toEqual(['design-system-unapplied']);
      expect(named.diagnostics[0]?.message).toContain('"acme@2.1.0"');
      // The bytes are the default output: the reference itself changes nothing.
      const plain = await write(core(), { compress: false });
      expect(plain.diagnostics).toEqual([]);
      expect(Buffer.from(named.bytes).equals(Buffer.from(plain.bytes))).toBe(true);
      const inline = await write(core({ inline: minimal }), { compress: false });
      expect(inline.diagnostics[0]?.message).toContain('an inline one');
      const styled = await write(core({ ref: 'acme@2.1.0' }), { compress: false, design });
      expect(styled.diagnostics).toEqual([]);
      expect(Buffer.from(styled.bytes).equals(Buffer.from(plain.bytes))).toBe(false);
    }
  });
});
