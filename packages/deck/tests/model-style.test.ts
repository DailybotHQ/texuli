// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DECK_CANVAS, DECK_TRANSITIONS } from '../src/model/shared.ts';
import {
  DECK_STYLE_DEFAULTS,
  DECK_THEME_MODES,
  DECK_TRANSITION_CAP_MS,
  type DeckStyle,
  deckStyle,
  deckThemeReference,
  normalizeThemeReference,
  resolveDeckStyle,
  resolveDeckTransition,
  resolveThemeMode,
} from '../src/model/style/index.ts';
import { toJsonSchema, validate } from '../src/schema/index.ts';

const issuesOf = (schema: Parameters<typeof validate>[0], input: unknown): string[] =>
  validate(schema, input).issues.map((issue) => `${issue.code} ${issue.jsonPath}`);

describe('theme references', () => {
  it('accepts the shorthand and the three kinds, with every mode', () => {
    const good: unknown[] = [
      'amber',
      'apex-rose',
      'a'.repeat(64),
      { kind: 'catalog', id: 'amber' },
      { kind: 'seed', seed: 0 },
      { kind: 'seed', seed: 0xffffffff, mode: 'dark' },
      { kind: 'embedded', theme: { id: 'custom', name: 'Custom', light: {}, dark: {} } },
      ...DECK_THEME_MODES.map((mode) => ({ kind: 'catalog', id: 'amber', mode })),
    ];
    for (const value of good)
      expect(issuesOf(deckThemeReference, value), JSON.stringify(value)).toEqual([]);
  });

  it('refuses bad ids, seeds, modes, kinds and unbounded embedded themes', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
    const cases: [unknown, string[]][] = [
      ['Amber', ['pattern $']],
      ['-amber', ['pattern $']],
      ['a'.repeat(65), ['too-long $']],
      ['amber</style>', ['pattern $']],
      [{ kind: 'catalog', id: 'amber', mode: 'sepia' }, ['enum $.mode']],
      [{ kind: 'catalog' }, ['required $.id']],
      [{ kind: 'seed', seed: -1 }, ['out-of-range $.seed']],
      [{ kind: 'seed', seed: 0x100000000 }, ['out-of-range $.seed']],
      [{ kind: 'seed', seed: 1.5 }, ['not-integer $.seed']],
      [{ kind: 'seed', seed: '12' }, ['invalid-type $.seed']],
      [{ kind: 'url', href: 'https://example.com/theme.css' }, ['unknown-theme-kind $.kind']],
      [{ kind: 'embedded', theme: 'amber' }, ['embedded-theme $.theme']],
      [{ kind: 'embedded', theme: [1, 2] }, ['embedded-theme $.theme']],
      [{ kind: 'embedded', theme: deep }, ['too-deep $.theme.a.b.c.d.e.f']],
      [{ kind: 'embedded', theme: { name: 'x'.repeat(513) } }, ['too-long $.theme.name']],
      [{ kind: 'embedded', theme: { name: 'a\u202Eb' } }, ['unsafe-text $.theme.name']],
      [{ kind: 'catalog', id: 'amber', extra: true }, ['unknown-key $.extra']],
      [42, ['invalid-type $']],
    ];
    for (const [input, expected] of cases) {
      expect(issuesOf(deckThemeReference, input), JSON.stringify(input)).toEqual(expected);
    }
    const proto = JSON.parse('{"kind":"embedded","theme":{"__proto__":{"x":1}}}');
    expect(issuesOf(deckThemeReference, proto).map((issue) => issue.split(' ')[0])).toEqual([
      'unsafe-key',
    ]);
  });

  it('normalizes the shorthand and resolves the mode: reference, host, light', () => {
    expect(normalizeThemeReference(undefined)).toBeUndefined();
    expect(normalizeThemeReference('amber')).toEqual({ kind: 'catalog', id: 'amber' });
    const seed = { kind: 'seed', seed: 7, mode: 'dark' } as const;
    expect(normalizeThemeReference(seed)).toEqual(seed);
    expect(normalizeThemeReference(seed)).not.toBe(seed);
    const cases: [
      Parameters<typeof resolveThemeMode>[0],
      Parameters<typeof resolveThemeMode>[1],
      string,
    ][] = [
      [undefined, undefined, 'light'],
      ['amber', 'dark', 'dark'],
      [{ kind: 'catalog', id: 'amber', mode: 'high-contrast' }, 'dark', 'high-contrast'],
      [{ kind: 'catalog', id: 'amber', mode: 'system' }, 'dark', 'dark'],
      [{ kind: 'catalog', id: 'amber', mode: 'system' }, undefined, 'light'],
    ];
    for (const [reference, host, mode] of cases)
      expect(resolveThemeMode(reference, host)).toBe(mode);
  });
});

describe('deck style schema', () => {
  const full: DeckStyle = {
    theme: { kind: 'catalog', id: 'amber', mode: 'dark' },
    fontPair: 'editorial',
    aspect: '9:16',
    density: 'spacious',
    radius: 'full',
    motion: 'subtle',
    transition: 'morph',
    background: { kind: 'gradient', gradient: 'dusk', angle: 90 },
    logo: 'assets/logo.png',
    footer: 'Fictional Corp · example.com',
    slideNumbers: false,
    progress: 'top',
    codeTheme: 'github-dark',
    math: true,
  };

  it('accepts an empty and a full style without injecting defaults', () => {
    const empty = validate(deckStyle, {});
    expect(empty.ok && empty.value).toEqual({});
    expect(empty.normalized).toEqual([]);
    const ok = validate(deckStyle, full);
    expect(ok.ok && ok.value).toEqual(full);
  });

  it('checks every field at its boundary', () => {
    const cases: [DeckStyle | Record<string, unknown>, string[]][] = [
      [{ footer: 'x'.repeat(160) }, []],
      [{ footer: 'x'.repeat(161) }, ['too-long $.footer']],
      [{ footer: 'a\nb' }, ['unsafe-text $.footer']],
      [{ logo: `${'a'.repeat(508)}.png` }, []],
      [{ logo: `${'a'.repeat(509)}.png` }, ['too-long $.logo']],
      [{ logo: 'javascript:alert(1)' }, ['pattern $.logo']],
      [{ logo: '' }, ['too-short $.logo', 'pattern $.logo']],
      [{ aspect: '21:9' }, ['enum $.aspect']],
      [{ density: 'cozy' }, ['enum $.density']],
      [{ radius: 'huge' }, ['enum $.radius']],
      [{ motion: 'reduced' }, ['enum $.motion']],
      [{ transition: 'cube' }, ['enum $.transition']],
      [{ background: 'gradient-rainbow' }, ['unknown-background $.background']],
      [{ progress: false }, ['enum $.progress']],
      [{ slideNumbers: 'yes' }, ['invalid-type $.slideNumbers']],
      [{ fontPair: 'Editorial' }, ['pattern $.fontPair']],
      [{ codeTheme: 'x'.repeat(65) }, ['too-long $.codeTheme']],
      [{ math: 1 }, ['invalid-type $.math']],
      [{ paletteSeed: 7 }, ['unknown-key $.paletteSeed']],
      [{ colour: 'red', aspect: '2:1' }, ['unknown-key $.colour', 'enum $.aspect']],
    ];
    for (const [input, expected] of cases) {
      expect(issuesOf(deckStyle, input).sort(), JSON.stringify(input).slice(0, 80)).toEqual(
        [...expected].sort()
      );
    }
  });

  it('exports a JSON Schema with every field', () => {
    const schema = toJsonSchema(deckStyle) as { properties?: Record<string, unknown> };
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(Object.keys(full).sort());
  });
});

describe('resolveDeckStyle', () => {
  it('applies every documented default', () => {
    const resolved = resolveDeckStyle();
    expect(resolved.style).toEqual({ ...DECK_STYLE_DEFAULTS });
    expect(resolved.mode).toBe('light');
    expect(resolved.canvas).toEqual({ width: 1280, height: 720 });
    expect(resolved.transition).toEqual({ name: 'fade', durationMs: 300 });
    expect(resolved.issues).toEqual([]);
    expect(resolved.cssVars).toEqual({
      '--tx-deck-aspect-ratio': '16 / 9',
      '--tx-deck-canvas-width': '1280px',
      '--tx-deck-canvas-height': '720px',
      '--tx-deck-density': '1',
      '--tx-deck-radius': '0.625rem',
      '--tx-deck-motion': 'full',
      '--tx-deck-transition': 'fade',
      '--tx-deck-transition-duration': '300ms',
      '--tx-deck-background': 'solid-color',
      '--tx-deck-progress': 'bottom',
      '--tx-deck-slide-numbers': '1',
    });
  });

  it('maps aspect, density, radius, progress and slide numbers to variables', () => {
    const table: [DeckStyle, Record<string, string>][] = [
      [
        { aspect: '4:3' },
        { '--tx-deck-aspect-ratio': '4 / 3', '--tx-deck-canvas-width': '1024px' },
      ],
      [
        { aspect: '9:16' },
        { '--tx-deck-aspect-ratio': '9 / 16', '--tx-deck-canvas-height': '1280px' },
      ],
      [
        { aspect: '1:1' },
        { '--tx-deck-aspect-ratio': '1 / 1', '--tx-deck-canvas-width': '1080px' },
      ],
      [{ density: 'compact' }, { '--tx-deck-density': '0.875' }],
      [{ density: 'comfortable' }, { '--tx-deck-density': '1.125' }],
      [{ density: 'spacious' }, { '--tx-deck-density': '1.25' }],
      [{ radius: 'none' }, { '--tx-deck-radius': '0' }],
      [{ radius: 'small' }, { '--tx-deck-radius': '0.25rem' }],
      [{ radius: 'large' }, { '--tx-deck-radius': '1rem' }],
      [{ radius: 'full' }, { '--tx-deck-radius': '9999px' }],
      [
        { progress: 'none', slideNumbers: false },
        { '--tx-deck-progress': 'none', '--tx-deck-slide-numbers': '0' },
      ],
      [{ background: 'pattern-grid' }, { '--tx-deck-background': 'pattern-grid' }],
      [{ background: { kind: 'image', src: 'a.png' } }, { '--tx-deck-background': 'image' }],
    ];
    for (const [style, expected] of table) {
      const resolved = resolveDeckStyle(style);
      expect(resolved.cssVars, JSON.stringify(style)).toMatchObject(expected);
      if (style.aspect) expect(resolved.canvas).toEqual(DECK_CANVAS[style.aspect]);
    }
  });

  it('plays transitions per the motion ceiling and reduced motion, capped at 400 ms', () => {
    const full: Record<string, [string, number]> = {
      none: ['none', 0],
      fade: ['fade', 300],
      'fade-up': ['fade-up', 300],
      slide: ['slide', 400],
      zoom: ['zoom', 350],
      morph: ['morph', 400],
    };
    const subtle: Record<string, [string, number]> = {
      none: ['none', 0],
      fade: ['fade', 180],
      'fade-up': ['fade-up', 180],
      slide: ['slide', 240],
      zoom: ['fade', 180],
      morph: ['morph', 240],
    };
    for (const transition of DECK_TRANSITIONS) {
      const [fullName, fullMs] = full[transition] as [string, number];
      const [subtleName, subtleMs] = subtle[transition] as [string, number];
      expect(resolveDeckTransition(transition, 'full')).toEqual({
        name: fullName,
        durationMs: fullMs,
      });
      expect(resolveDeckTransition(transition, 'subtle')).toEqual({
        name: subtleName,
        durationMs: subtleMs,
      });
      expect(resolveDeckTransition(transition, 'none')).toEqual({ name: 'none', durationMs: 0 });
      const reduced = resolveDeckTransition(transition, 'full', true);
      expect(reduced).toEqual(
        transition === 'none' ? { name: 'none', durationMs: 0 } : { name: 'fade', durationMs: 150 }
      );
      for (const motion of ['full', 'subtle', 'none'] as const) {
        expect(resolveDeckTransition(transition, motion).durationMs).toBeLessThanOrEqual(
          DECK_TRANSITION_CAP_MS
        );
      }
    }
    // Reduced motion lowers the ceiling, never raises it.
    expect(resolveDeckStyle({ motion: 'full' }, { reducedMotion: true }).motion).toBe('subtle');
    expect(
      resolveDeckStyle({ motion: 'none' }, { reducedMotion: true }).cssVars['--tx-deck-motion']
    ).toBe('none');
    expect(
      resolveDeckStyle({ motion: 'subtle' }, { reducedMotion: true }).cssVars[
        '--tx-deck-transition-duration'
      ]
    ).toBe('150ms');
  });

  it('merges a slide override without losing deck-level settings', () => {
    const resolved = resolveDeckStyle(
      {
        theme: 'amber',
        footer: 'Deck footer',
        logo: 'mark.png',
        progress: 'top',
        transition: 'fade',
      },
      {
        override: {
          footer: 'Slide footer',
          background: 'gradient-dusk',
          transition: 'zoom',
          theme: { kind: 'seed', seed: 0x12ab34, mode: 'dark' },
        },
      }
    );
    expect(resolved.style).toMatchObject({
      theme: { kind: 'seed', seed: 0x12ab34, mode: 'dark' },
      footer: 'Slide footer',
      logo: 'mark.png',
      background: 'gradient-dusk',
      progress: 'top',
      transition: 'zoom',
    });
    expect(resolved.mode).toBe('dark');
    expect(resolved.cssVars['--tx-deck-transition']).toBe('zoom');
    expect(resolveDeckStyle({ theme: 'amber' }).style.theme).toEqual({
      kind: 'catalog',
      id: 'amber',
    });
    expect(resolveDeckStyle({ theme: 'amber' }, { hostMode: 'high-contrast' }).mode).toBe(
      'high-contrast'
    );
  });

  it('warns on unknown theme, font pair and code theme ids when the host lists them', () => {
    const resolved = resolveDeckStyle(
      { theme: 'missing', fontPair: 'missing', codeTheme: 'missing' },
      {
        knownThemes: ['amber'],
        knownFontPairs: ['editorial'],
        knownCodeThemes: ['github-dark'],
        path: ['style'],
      }
    );
    expect(
      resolved.issues.map((issue) => `${issue.code} ${issue.severity} ${issue.jsonPath}`)
    ).toEqual([
      'unknown-theme warning $.style.theme',
      'unknown-font-pair warning $.style.fontPair',
      'unknown-code-theme warning $.style.codeTheme',
    ]);
    expect(resolved.style.theme).toBeUndefined();
    expect(resolved.style.fontPair).toBeUndefined();
    expect(resolved.style.codeTheme).toBeUndefined();
    // Without the lists, ids pass through for the stage to resolve.
    const passthrough = resolveDeckStyle({ theme: 'missing', fontPair: 'missing' });
    expect(passthrough.issues).toEqual([]);
    expect(passthrough.style.fontPair).toBe('missing');
    // Seeds and embedded themes are never checked against the catalog.
    expect(
      resolveDeckStyle({ theme: { kind: 'seed', seed: 1 } }, { knownThemes: [] }).issues
    ).toEqual([]);
  });

  it('never throws on hostile input: bad fields fall back, good ones survive', () => {
    const hostile: unknown[] = [
      null,
      42,
      'amber',
      [],
      { aspect: '21:9', radius: 'large' },
      { footer: 'a\u202Eb', density: 'compact', background: 'url(javascript:alert(1))' },
      { transition: { toString: () => 'zoom' }, progress: 'top' },
      JSON.parse('{"__proto__":{"motion":"none"},"slideNumbers":false}'),
      Object.create({ aspect: '4:3' }),
    ];
    for (const input of hostile) {
      const resolved = resolveDeckStyle(input, { path: ['style'] });
      expect(resolved.issues.length, String(input)).toBeGreaterThan(0);
      expect(resolved.issues.every((issue) => issue.jsonPath.startsWith('$.style'))).toBe(true);
      for (const [name, value] of Object.entries(resolved.cssVars)) {
        expect(name).toMatch(/^--tx-deck-[a-z]+(-[a-z]+)*$/);
        expect(value).toMatch(/^[a-z0-9 ./:-]+$/);
      }
    }
    const partial = resolveDeckStyle({ aspect: '21:9', radius: 'large' });
    expect(partial.style.aspect).toBe('16:9');
    expect(partial.style.radius).toBe('large');
    const proto = resolveDeckStyle(
      JSON.parse('{"__proto__":{"motion":"none"},"slideNumbers":false}')
    );
    expect(proto.style.motion).toBe('full');
    expect(proto.style.slideNumbers).toBe(false);
    expect(({} as Record<string, unknown>).motion).toBeUndefined();
  });

  it('keeps author strings out of CSS and names every variable --tx-deck-*', () => {
    const resolved = resolveDeckStyle({
      footer: 'Footer --py-x url(x)',
      logo: 'assets/logo.png',
      background: { kind: 'image', src: 'assets/secret-cover.webp' },
    });
    const text = JSON.stringify(resolved.cssVars);
    expect(text).not.toMatch(/Footer|logo|secret|url\(|--py-/);
    for (const name of Object.keys(resolved.cssVars))
      expect(name.startsWith('--tx-deck-')).toBe(true);
  });
});
