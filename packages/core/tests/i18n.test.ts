// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  CATALOG_LIMITS,
  createI18n,
  englishMessages,
  formatMessage,
  I18N_CONTEXT,
  interpolate,
  isPseudoLocalized,
  type MessageCatalog,
  PSEUDO_LOCALE,
  parseCatalog,
  pseudoLocalize,
  resolveLabel,
} from '../src/i18n/index.ts';

const es: MessageCatalog = {
  locale: 'es',
  messages: {
    'texuli.dialog.close': 'Cerrar',
    'texuli.tag.remove': 'Quitar {label}',
    'texuli.files.count': {
      plural: 'count',
      '=0': 'Sin archivos',
      one: '# archivo',
      other: '# archivos',
    },
    'texuli.alert.tone': { select: 'tone', danger: 'Peligro', other: 'Aviso' },
  },
};

describe('core/i18n: formatting', () => {
  it('substitutes placeholders in one pass and keeps unknown ones literal', () => {
    expect(interpolate('Remove {label}', { label: 'Urgent' })).toBe('Remove Urgent');
    expect(interpolate('Page {page} of {pages}', { page: 2, pages: 10 })).toBe('Page 2 of 10');
    expect(interpolate('Hi {missing} {bad name} {', {})).toBe('Hi {missing} {bad name} {');
    // A substituted value is never scanned again (non-recursive).
    expect(interpolate('{a}', { a: '{b}', b: 'boom' })).toBe('{b}');
    expect(interpolate('{n}', { n: 1234.5 }, 'de')).toBe('1.234,5');
  });

  it('resolves plural (exact, category, other) and select messages', () => {
    const files = es.messages['texuli.files.count'] as never;
    expect(formatMessage(files, { count: 0 }, 'es')).toBe('Sin archivos');
    expect(formatMessage(files, { count: 1 }, 'es')).toBe('1 archivo');
    expect(formatMessage(files, { count: 3 }, 'es')).toBe('3 archivos');
    expect(formatMessage(files, {}, 'es')).toBe('# archivos');
    const tone = es.messages['texuli.alert.tone'] as never;
    expect(formatMessage(tone, { tone: 'danger' })).toBe('Peligro');
    expect(formatMessage(tone, { tone: 'other-thing' })).toBe('Aviso');
    expect(formatMessage(tone, { tone: 'select' })).toBe('Aviso');
    expect(formatMessage({ junk: 1 } as never)).toBe('');
  });

  it('stays linear on hostile templates (runs of braces, huge inputs)', () => {
    const hostile = [
      '{'.repeat(200_000),
      `${'{a'.repeat(100_000)}}`,
      '#'.repeat(200_000),
      `${'{x}'.repeat(60_000)}`,
    ];
    for (const template of hostile) {
      const start = performance.now();
      interpolate(template, { x: 'y', a: 'b' }, 'en', '1');
      expect(performance.now() - start, template.slice(0, 8)).toBeLessThan(500);
    }
  });
});

describe('core/i18n: catalogs from untrusted JSON', () => {
  it('keeps valid messages and drops bad ids, prototype keys and oversized messages', () => {
    const parsed = parseCatalog(
      JSON.parse(
        JSON.stringify({
          locale: 'pt-BR',
          messages: {
            'texuli.dialog.close': 'Fechar',
            nodots: 'x',
            'texuli.big': 'x'.repeat(CATALOG_LIMITS.messageLength + 1),
            'texuli.obj': { plural: 'n', other: '#', __proto__x: 'y' },
            'texuli.both': { plural: 'n', select: 'n', other: 'x' },
            'texuli.code': { select: 'n', other: 1 },
          },
        })
      )
    );
    expect(parsed.catalog?.locale).toBe('pt-BR');
    expect(Object.keys(parsed.catalog?.messages ?? {})).toEqual(['texuli.dialog.close']);
    expect(parsed.issues.map((issue) => issue.id).sort()).toEqual([
      'nodots',
      'texuli.big',
      'texuli.both',
      'texuli.code',
      'texuli.obj',
    ]);
    const proto = parseCatalog(JSON.parse('{"locale":"en","messages":{"__proto__":{"x":"y"}}}'));
    expect(Object.keys(proto.catalog?.messages ?? {})).toEqual([]);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(parseCatalog({ locale: 'not a tag!', messages: {} }).catalog).toBeNull();
    expect(parseCatalog(null).catalog).toBeNull();
    expect(parseCatalog({ locale: 'en', messages: [] }).catalog).toBeNull();
  });
});

describe('core/i18n: runtime', () => {
  it('resolves the active locale, then the base language, then the English default', async () => {
    const i18n = createI18n({ catalogs: [es] });
    expect(i18n.t('texuli.dialog.close', 'Close')).toBe('Close');
    expect(await i18n.setLocale('es-MX')).toBe(true);
    expect(i18n.locale).toBe('es-MX');
    expect(i18n.t('texuli.dialog.close', 'Close')).toBe('Cerrar');
    expect(i18n.t('texuli.tag.remove', 'Remove {label}', { label: 'Urgente' })).toBe(
      'Quitar Urgente'
    );
    expect(i18n.t('texuli.unknown.id', 'Fallback {n}', { n: 2 })).toBe('Fallback 2');
    expect(i18n.has('texuli.dialog.close')).toBe(true);
    expect(i18n.has('texuli.unknown.id')).toBe(false);
  });

  it('loads a locale lazily, only when it becomes active, once', async () => {
    const loader = vi.fn(async () => ({
      default: { locale: 'fr', messages: { 'texuli.a.b': 'Fermer' } },
    }));
    const unused = vi.fn(async () => ({ locale: 'de', messages: {} }));
    const i18n = createI18n({ loaders: { fr: loader, de: unused } });
    const listener = vi.fn();
    i18n.subscribe(listener);
    expect(loader).not.toHaveBeenCalled();
    const [first, second] = await Promise.all([i18n.setLocale('fr'), i18n.setLocale('fr')]);
    expect([first, second]).toEqual([false, true]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(unused).not.toHaveBeenCalled();
    expect(i18n.t('texuli.a.b', 'Close')).toBe('Fermer');
    expect(listener).toHaveBeenCalled();
    expect(i18n.version).toBeGreaterThan(0);
  });

  it('keeps the current locale when a loader fails or is missing, and the latest call wins', async () => {
    const onIssues = vi.fn();
    const i18n = createI18n({
      catalogs: [es],
      loaders: { it: async () => Promise.reject(new Error('offline')) },
      onIssues,
    });
    await i18n.setLocale('es');
    expect(await i18n.setLocale('it')).toBe(false);
    expect(await i18n.setLocale('ja')).toBe(false);
    expect(i18n.locale).toBe('es');
    expect(onIssues).toHaveBeenCalledWith('it', [{ id: '', message: 'offline' }]);
    let release: (catalog: MessageCatalog) => void = () => {};
    const gate = new Promise<MessageCatalog>((resolve) => {
      release = resolve;
    });
    i18n.registerLocale('nl', () => gate);
    const slow = i18n.setLocale('nl');
    const fast = i18n.setLocale('en');
    release({ locale: 'nl', messages: { 'texuli.dialog.close': 'Sluiten' } });
    expect(await slow).toBe(false);
    expect(await fast).toBe(true);
    expect(i18n.locale).toBe('en');
  });

  it('applies the instance prop, then context, then the English default', () => {
    const i18n = createI18n({ catalogs: [es], locale: 'es' });
    expect(resolveLabel('Shut', i18n, 'texuli.dialog.close', 'Close')).toBe('Shut');
    expect(resolveLabel(undefined, i18n, 'texuli.dialog.close', 'Close')).toBe('Cerrar');
    expect(resolveLabel(undefined, null, 'texuli.dialog.close', 'Close')).toBe('Close');
    expect(englishMessages('x.y', 'Remove {label}', { label: 'A' })).toBe('Remove A');
    expect(I18N_CONTEXT).toBe(Symbol.for('texuli.i18n'));
  });

  it('pseudo-localizes every resolved string, catalog or default, keeping placeholders', async () => {
    const i18n = createI18n({ catalogs: [es] });
    expect(await i18n.setLocale(PSEUDO_LOCALE)).toBe(true);
    const out = i18n.t('texuli.tag.remove', 'Remove {label}', { label: 'x' });
    expect(isPseudoLocalized(out)).toBe(true);
    expect(out).toBe('⟦Rémóvé x⟧');
    expect(pseudoLocalize('Close {name}')).toBe('⟦Çlósé {name}⟧');
  });
});

describe('core/i18n: documentation', () => {
  it('is a subpath export whose page names every export', async () => {
    const { readFileSync } = await import('node:fs');
    const exportsMap = JSON.parse(readFileSync('packages/core/package.json', 'utf8')).exports;
    expect(exportsMap['./i18n']).toBe('./src/i18n/index.ts');
    const doc = readFileSync('packages/core/docs/core-i18n.md', 'utf8');
    const source = readFileSync('packages/core/src/i18n/index.ts', 'utf8');
    const names = new Set<string>();
    for (const match of source.matchAll(/export\s+\{([^}]*)\}/g)) {
      for (const raw of (match[1] ?? '').split(',')) {
        const name = /(\w+)$/.exec(raw.trim().replace(/^type\s+/, ''))?.[1];
        if (name) names.add(name);
      }
    }
    expect(names.size).toBeGreaterThan(20);
    expect([...names].filter((name) => !new RegExp(`\`${name}\\b`).test(doc))).toEqual([]);
    expect(readFileSync('packages/core/README.md', 'utf8')).toContain('core-i18n.md');
  });
});

describe('core/i18n: cross-target vectors (native/conformance reads the same file)', () => {
  it('interpolates every shared vector to its expected text', async () => {
    const { readFileSync } = await import('node:fs');
    const { vectors } = JSON.parse(
      readFileSync('packages/core/tests/fixtures/i18n-vectors.json', 'utf8')
    ) as {
      vectors: { template: string; values: Record<string, string>; expected: string }[];
    };
    expect(vectors.length).toBeGreaterThan(5);
    for (const vector of vectors) {
      expect(interpolate(vector.template, vector.values), vector.template).toBe(vector.expected);
    }
  });
});
