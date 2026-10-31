// @vitest-environment node
/**
 * The Design System Studio's logic (PLAN_011 T-ds-studio): the share-link
 * codec and its caps (hostile hashes refused with codes, never thrown), the
 * editor's field table proven against the spec's validator (every bound and
 * option of every section, every component token and default), the pure
 * path helpers, import detection, and the lazy engine end to end (compile,
 * library bases, imports, every export format, the legacy `#theme=` link).
 * The rendered studio is covered by tests/e2e/site-ds-studio.spec.ts.
 */
import { randomBytes } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { COMPONENT_TOKEN_FAMILIES } from '@texuli/tokens/components';
import { dtcgFixture, tokensStudioFixture } from '@texuli/tokens/design-system/fixtures';
import { validateDesignSystem } from '@texuli/tokens/design-system/validate';
import { DESIGN_DEFAULTS_VOCABULARY } from 'texuli/defaults';
import { describe, expect, it } from 'vitest';
import {
  buildExport,
  compileStudio,
  documentFromLegacyHash,
  importText,
} from '../src/components/theme-studio/ds-engine.ts';
import {
  decodeShareHash,
  encodeShareHash,
  isShareHash,
  SHARE_LIMITS,
  SHARE_PREFIX,
  toBase64Url,
} from '../src/components/theme-studio/ds-share.ts';
import {
  CODE_EXPLANATIONS,
  componentTokenField,
  detectImportKind,
  EXPORT_FORMATS,
  explainCode,
  exportFileName,
  type FieldSpec,
  formatValue,
  getAt,
  issuePath,
  issuesAt,
  libraryDocument,
  parseValue,
  ROLES,
  rolePinField,
  SECTIONS,
  seedDocument,
  setAt,
  TYPE_ROLES,
  tokenKind,
  typeRoleFields,
} from '../src/components/theme-studio/ds-studio.ts';
import { FEATURED_LIBRARY_THEMES } from '../src/components/theme-studio/presets.ts';
import { encodeStudioShare } from '../src/components/theme-studio/studio.ts';

const valid = (doc: unknown) => validateDesignSystem(doc, { trust: 'untrusted' });
const codesAt = (doc: unknown, path: string) =>
  valid(doc)
    .errors.filter((issue) => issue.path === path)
    .map((issue) => issue.code);

/** A hash body for arbitrary bytes, compressed as the studio does. */
const rawHash = (bytes: Uint8Array) => `${SHARE_PREFIX}1.${toBase64Url(deflateRawSync(bytes))}`;

describe('share links', () => {
  it('round-trips a document through the fragment', async () => {
    const doc = setAt(seedDocument('#0f766e'), ['shape', 'radius'], 12);
    const encoded = await encodeShareHash(doc);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.hash.startsWith('#ds=1.')).toBe(true);
    expect(encoded.hash).toMatch(/^#ds=1\.[A-Za-z0-9_-]+$/);
    expect(isShareHash(encoded.hash)).toBe(true);
    const decoded = await decodeShareHash(encoded.hash);
    expect(decoded).toMatchObject({ ok: true, value: doc });
  });

  it('refuses hostile and damaged hashes with codes, never throwing', async () => {
    const cases: Array<[string, string]> = [
      ['#theme=s=c', 'share-format'],
      ['#ds=', 'share-format'],
      ['#ds=1.<script>', 'share-format'],
      ['#ds=1.abc%20def', 'share-format'],
      ['#ds=2.AAAA', 'share-version'],
      [`#ds=1.${'A'.repeat(SHARE_LIMITS.hashChars)}`, 'share-too-long'],
      ['#ds=1.A', 'share-encoding'],
      ['#ds=1.____', 'share-encoding'],
      [rawHash(new TextEncoder().encode('not json')), 'share-json'],
      [rawHash(new TextEncoder().encode('[1,2,3]')), 'share-json'],
      [rawHash(new TextEncoder().encode('"text"')), 'share-json'],
      [rawHash(new TextEncoder().encode('null')), 'share-json'],
      [rawHash(new Uint8Array([0xff, 0xfe, 0x7b, 0x7d])), 'share-encoding'],
    ];
    for (const [hash, code] of cases) {
      const result = await decodeShareHash(hash);
      expect(result, hash.slice(0, 40)).toMatchObject({ ok: false, code });
      if (!result.ok) expect(explainCode(result.code)).not.toMatch(/^Refused with code/);
    }
  });

  it('stops a small link that inflates past the cap (a compression bomb)', async () => {
    const bomb = new Uint8Array(SHARE_LIMITS.jsonBytes * 4).fill(0x20);
    const hash = rawHash(bomb);
    expect(hash.length).toBeLessThan(SHARE_LIMITS.hashChars);
    expect(await decodeShareHash(hash)).toMatchObject({ ok: false, code: 'share-too-large' });
  });

  it('refuses to write a link over the caps', async () => {
    const huge = { ...seedDocument(), description: 'x'.repeat(SHARE_LIMITS.jsonBytes) };
    expect(await encodeShareHash(huge)).toMatchObject({ ok: false, code: 'share-too-large' });
    // Incompressible text: under the JSON cap, over the link cap.
    const noise = randomBytes(30_000).toString('hex');
    expect(await encodeShareHash({ ...seedDocument(), description: noise })).toMatchObject({
      ok: false,
      code: 'share-too-long',
    });
  });

  it('decodes a link into plain data that the untrusted validator then judges', async () => {
    const hostile = {
      ...seedDocument(),
      assets: { logo: { light: 'data:image/png;base64,AAAA', dark: 'https://evil.example/x.png' } },
      __proto__: { polluted: true },
    };
    const encoded = await encodeShareHash(JSON.parse(JSON.stringify(hostile)));
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const decoded = await decodeShareHash(encoded.hash);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const compiled = await compileStudio(decoded.value);
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.issues.map((issue) => issue.code)).toContain('url-refused');
      expect(compiled.issues.map((issue) => issue.path)).toContain('$.assets.logo.light');
    }
  });
});

describe('the field table matches the spec vocabulary', () => {
  const fields: FieldSpec[] = [
    ...SECTIONS.flatMap((section) => section.fields),
    ...TYPE_ROLES.flatMap((role) => typeRoleFields(role)),
    ...ROLES.map((role) => rolePinField('dark', role)),
  ];

  /** A value for a field that the validator should accept. */
  function sample(spec: FieldSpec): unknown[] {
    switch (spec.kind) {
      case 'color':
        return ['#123456'];
      case 'number':
      case 'integer':
        return [spec.min, spec.max];
      case 'enum':
        return [...(spec.options ?? [])];
      case 'modes':
        return (spec.options ?? []).map((option) => option.split(' '));
      case 'bool':
        return [true];
      case 'map':
        return [{ workspace: 'team space' }];
      case 'lines':
        return [['Say what happened first.']];
      case 'list': {
        const key = spec.path.join('.');
        if (key.includes('categorical')) return [Array.from({ length: 8 }, () => '#336699')];
        if (key.includes('stack')) return [['Inter', 'system-ui']];
        return [['clear', 'warm']];
      }
      default: {
        const key = spec.path.join('.');
        if (key === 'id') return ['acme'];
        if (key === 'version') return ['2.1.0'];
        if (key === 'extends') return ['texuli:enterprise-neutral'];
        if (key.startsWith('assets')) return ['assets/logo.svg'.replace('svg', 'png')];
        return ['Acme Design'];
      }
    }
  }

  it('accepts every bound and option the editor offers', () => {
    expect(fields.length).toBeGreaterThan(150);
    for (const spec of fields) {
      for (const value of sample(spec)) {
        const doc = setAt(seedDocument(), spec.path, value);
        expect(valid(doc).errors, `${spec.path.join('.')} = ${JSON.stringify(value)}`).toEqual([]);
      }
    }
  });

  it('every numeric bound is the spec bound: one step past it is refused at the field path', () => {
    for (const spec of fields) {
      if (spec.kind !== 'number' && spec.kind !== 'integer') continue;
      const over = (spec.max as number) + (spec.kind === 'integer' ? 1 : 0.5);
      const under = (spec.min as number) - (spec.kind === 'integer' ? 1 : 0.5);
      for (const value of [over, under]) {
        const doc = setAt(seedDocument(), spec.path, value);
        expect(codesAt(doc, issuePath(spec.path)), `${spec.path.join('.')} = ${value}`).toContain(
          'invalid-value'
        );
      }
    }
  });

  it('covers every top-level section of the document', () => {
    const covered = new Set(
      SECTIONS.flatMap((section) => section.fields.map((spec) => spec.path[0]))
    );
    for (const section of [
      'id',
      'version',
      'name',
      'extends',
      'color',
      'typography',
      'space',
      'shape',
      'elevation',
      'surface',
      'motion',
      'layout',
      'icons',
      'assets',
      'voice',
      'accessibility',
    ]) {
      expect(covered.has(section), section).toBe(true);
    }
  });

  it('infers every component token kind so its first option validates', () => {
    let count = 0;
    for (const family of COMPONENT_TOKEN_FAMILIES) {
      for (const token of family.tokens) {
        if (/z-index/.test(token.key)) continue;
        const spec = componentTokenField(
          family.component,
          token.key,
          tokenKind(token.key, token.default)
        );
        const value = spec.kind === 'enum' ? spec.options?.[0] : spec.min;
        const doc = setAt(seedDocument(), spec.path, value);
        expect(valid(doc).errors, `${family.component}.${token.key}`).toEqual([]);
        count += 1;
      }
    }
    expect(count).toBeGreaterThan(300);
  });

  it('offers every component default the vocabulary allows', () => {
    const vocabulary = DESIGN_DEFAULTS_VOCABULARY as Record<
      string,
      { variant?: readonly string[]; size?: readonly string[] }
    >;
    for (const [component, entry] of Object.entries(vocabulary)) {
      for (const key of ['variant', 'size'] as const) {
        for (const value of entry[key] ?? []) {
          const doc = setAt(seedDocument(), ['components', component, 'defaults', key], value);
          expect(valid(doc).errors, `${component}.${key}=${value}`).toEqual([]);
        }
      }
    }
  });
});

describe('path helpers and values', () => {
  it('writes, reads and prunes immutably; reserved keys are refused', () => {
    const doc = seedDocument();
    const next = setAt(doc, ['components', 'icon-button', 'radius'], 'full');
    expect(getAt(next, ['components', 'icon-button', 'radius'])).toBe('full');
    expect(getAt(doc, ['components'])).toBeUndefined();
    const cleared = setAt(next, ['components', 'icon-button', 'radius'], undefined);
    expect('components' in cleared).toBe(false);
    expect(setAt(doc, ['__proto__', 'polluted'], true)).toBe(doc);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('names paths the way the spec reports them', () => {
    expect(issuePath(['components', 'icon-button', 'radius'])).toBe(
      '$.components["icon-button"].radius'
    );
    expect(issuePath(['color', 'brand', 'seed'])).toBe('$.color.brand.seed');
    const issues = [
      { code: 'invalid-value', path: '$.color.brand.seed', message: '' },
      { code: 'aa-text', path: '$.color.roles.light.foreground', message: '' },
      { code: 'invalid-value', path: '$.color.brand.seed', message: '', source: 'variant:x' },
    ];
    expect(issuesAt(issues, ['color', 'brand', 'seed'])).toHaveLength(1);
    expect(issuesAt(issues, ['color'])).toHaveLength(2);
  });

  it('parses control text into document values and back', () => {
    const list: FieldSpec = { path: ['tags'], label: 'Tags', kind: 'list' };
    expect(parseValue(list, ' a, b ,,c ')).toEqual(['a', 'b', 'c']);
    expect(formatValue(list, ['a', 'b'])).toBe('a, b');
    const number: FieldSpec = { path: ['shape', 'radius'], label: 'Radius', kind: 'number' };
    expect(parseValue(number, '12')).toBe(12);
    expect(parseValue(number, 'twelve')).toBe('twelve');
    expect(parseValue(number, '  ')).toBeUndefined();
    const map: FieldSpec = { path: ['voice', 'lexicon'], label: 'Lexicon', kind: 'map' };
    expect(parseValue(map, 'workspace = team space\n__proto__ = x\nbad line')).toEqual({
      workspace: 'team space',
    });
    expect(formatValue(map, { workspace: 'team space' })).toBe('workspace = team space');
    const modes: FieldSpec = { path: ['color', 'modes'], label: 'Modes', kind: 'modes' };
    expect(parseValue(modes, 'light dark')).toEqual(['light', 'dark']);
  });

  it('detects the importer from the file shape', () => {
    expect(detectImportKind(seedDocument())).toBe('design-system');
    expect(detectImportKind(dtcgFixture())).toBe('dtcg');
    expect(detectImportKind(tokensStudioFixture())).toBe('tokens-studio');
    expect(detectImportKind({ light: { primary: '#000000' }, dark: { primary: '#ffffff' } })).toBe(
      'role-palette'
    );
    expect(detectImportKind(null)).toBe('dtcg');
  });

  it('names export files safely and explains every code it shows', () => {
    expect(exportFileName('acme', 'css')).toBe('acme.css');
    expect(exportFileName('../../etc/passwd', 'document')).toBe('studio.design-system.json');
    expect(exportFileName(undefined, 'report')).toBe('studio.report.html');
    for (const code of [
      'unknown-key',
      'invalid-type',
      'invalid-value',
      'required',
      'format-version',
      'extends-range',
      'extends-cycle',
      'extends-depth',
      'url-refused',
      'inline-bytes',
      'aa-text',
      'aa-focus',
      'target-size',
    ]) {
      expect(CODE_EXPLANATIONS[code], code).toBeTruthy();
    }
  });
});

describe('the engine', () => {
  it('compiles the seed document and every featured library base', async () => {
    const seed = await compileStudio(seedDocument());
    expect(seed.ok).toBe(true);
    for (const theme of FEATURED_LIBRARY_THEMES) {
      const result = await compileStudio(libraryDocument(theme.id, theme.id));
      expect(result.ok, theme.id).toBe(true);
    }
    const unknown = await compileStudio(libraryDocument('no-such-theme', 'x'));
    expect(unknown).toMatchObject({ ok: false });
  });

  it('refuses an invalid document with codes and paths, and compiles a variant', async () => {
    const bad = setAt(
      setAt(seedDocument(), ['shape', 'radius'], 99),
      ['color', 'brand', 'seed'],
      'red'
    );
    const result = await compileStudio(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'invalid-value', path: '$.shape.radius' }),
          expect.objectContaining({ code: 'invalid-value', path: '$.color.brand.seed' }),
        ])
      );
    }
    const pinned = setAt(
      setAt(seedDocument(), ['color', 'roles', 'light', 'foreground'], '#ffffff'),
      ['color', 'roles', 'light', 'background'],
      '#ffffff'
    );
    const refused = await compileStudio(pinned);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.issues.map((issue) => issue.code)).toContain('aa-text');
    const withVariant = setAt(seedDocument(), ['variants', 'compact'], {
      space: { density: 0.875 },
    });
    const compact = await compileStudio(withVariant, 'compact');
    expect(compact.ok && compact.compiled.attrs['data-tx-ds-variant']).toBe('compact');
  });

  it('imports DTCG, Tokens Studio and design-system files, and refuses junk', async () => {
    const dtcg = await importText(JSON.stringify(dtcgFixture()));
    expect(dtcg).toMatchObject({ ok: true, kind: 'dtcg' });
    const studio = await importText(JSON.stringify(tokensStudioFixture()));
    expect(studio).toMatchObject({ ok: true, kind: 'tokens-studio' });
    const own = await importText(JSON.stringify(seedDocument('#b45309')));
    expect(own).toMatchObject({ ok: true, kind: 'design-system' });
    expect(await importText('{nope')).toMatchObject({ ok: false });
    expect(await importText(' '.repeat(1_048_577))).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'input-limit' })],
    });
  });

  it('builds every export format from a compiled design system', async () => {
    const doc = setAt(seedDocument('#7c3aed'), ['components', 'button', 'radius'], 'full');
    const result = await compileStudio(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(EXPORT_FORMATS.map((format) => format.id)).toEqual([
      'document',
      'compiled',
      'css',
      'tailwind',
      'dtcg',
      'tokens-studio',
      'report',
      'email',
    ]);
    for (const format of EXPORT_FORMATS) {
      const text = await buildExport(format.id, doc, result.compiled);
      expect(text, format.id).toBeTruthy();
      if (!text) continue;
      if (format.mime === 'application/json')
        expect(() => JSON.parse(text), format.id).not.toThrow();
      if (format.mime === 'text/html')
        expect(text.toLowerCase(), format.id).toContain('<!doctype html>');
    }
    const css = await buildExport('css', doc, result.compiled);
    expect(css).toContain('[data-tx-ds="studio"]');
    expect(css).toContain('--tx-button-radius');
    // The document export re-imports to the same document.
    const again = await importText((await buildExport('document', doc, result.compiled)) ?? '');
    expect(again).toMatchObject({ ok: true, document: doc });
    // DTCG round trip.
    const dtcg = await importText((await buildExport('dtcg', doc, result.compiled)) ?? '');
    expect(dtcg.ok && getAt(dtcg.document, ['components', 'button', 'radius'])).toBe('full');
  });

  it('opens a legacy #theme= recipe link as a document', async () => {
    const hash = encodeStudioShare({
      source: 'color',
      seed: '#0f766e',
      secondary: '',
      words: '',
      neutral: 'zinc',
      contrast: 'AA',
      mode: 'light',
      edits: [],
    });
    expect(hash).toBeTruthy();
    const opened = await documentFromLegacyHash(hash ?? '');
    expect(opened.ok).toBe(true);
    if (opened.ok) expect((await compileStudio(opened.document)).ok).toBe(true);
    expect(await documentFromLegacyHash('#theme=s=x')).toMatchObject({ ok: false });
  });
});
