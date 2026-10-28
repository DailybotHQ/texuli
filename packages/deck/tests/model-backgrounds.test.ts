// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_CODES,
  chooseInk,
  compositeOver,
  contrastRatio,
  DECK_BACKGROUND_PRESET_IDS,
  DECK_BACKGROUND_PRESETS,
  DECK_SCRIM_MAX,
  DECK_TEXT_CONTRAST_MIN,
  type DeckBackground,
  type DeckBackgroundPalette,
  deckBackground,
  deckBackgroundSpec,
  isDeckBackgroundPreset,
  normalizeHex,
  opaqueColor,
  parseHexColor,
  type ResolvedDeckBackground,
  relativeLuminance,
  resolveDeckBackground,
  sampleGradient,
  scrimStepFor,
} from '../src/model/backgrounds/index.ts';
import { toJsonSchema, validate } from '../src/schema/index.ts';

/** Sample palettes (fictional themes): light and dark, strong and weak brand colors. */
const PALETTES: Record<string, DeckBackgroundPalette> = {
  'neutral-light': {
    background: '#ffffff',
    foreground: '#0a0a0a',
    surface: '#f5f5f5',
    primary: '#171717',
    accent: '#f4f4f5',
    muted: '#e5e5e5',
    border: '#d4d4d4',
    info: '#2563eb',
    success: '#16a34a',
    warning: '#f59e0b',
    destructive: '#dc2626',
  },
  'neutral-dark': {
    background: '#0a0a0a',
    foreground: '#fafafa',
    surface: '#171717',
    primary: '#e5e5e5',
    accent: '#262626',
    muted: '#262626',
    border: 'rgba(255, 255, 255, 0.1)',
    info: '#60a5fa',
    success: '#4ade80',
    warning: '#fbbf24',
    destructive: '#f87171',
  },
  'violet-light': {
    background: '#fcfcff',
    foreground: '#1e1b4b',
    surface: '#f5f3ff',
    primary: '#6d28d9',
    accent: '#ddd6fe',
    muted: '#ede9fe',
    border: '#c4b5fd',
    info: '#0ea5e9',
    success: '#059669',
    warning: '#d97706',
    destructive: '#e11d48',
  },
  'violet-dark': {
    background: '#13111c',
    foreground: '#ede9fe',
    surface: '#1c1830',
    primary: '#a78bfa',
    accent: '#4c1d95',
    muted: '#2e1065',
    border: '#4c1d95',
    info: '#38bdf8',
    success: '#34d399',
    warning: '#fbbf24',
    destructive: '#fb7185',
  },
  'amber-light': {
    background: '#fffbeb',
    foreground: '#451a03',
    surface: '#fef3c7',
    primary: '#f59e0b',
    accent: '#fde68a',
    muted: '#fef3c7',
    border: '#78350f',
    info: '#0891b2',
    success: '#65a30d',
    warning: '#ea580c',
    destructive: '#b91c1c',
  },
  // A weak theme: mid-gray everything. The guarantee must hold anyway.
  'mid-gray': {
    background: '#808080',
    foreground: '#909090',
    surface: '#7a7a7a',
    primary: '#888888',
    accent: '#777777',
    muted: '#858585',
    border: '#8a8a8a',
    info: '#7f7f9f',
    success: '#7f9f7f',
    warning: '#9f9f7f',
    destructive: '#9f7f7f',
  },
};

const MEDIA_SPECS: DeckBackground[] = [
  { kind: 'image', src: 'assets/cover.webp' },
  { kind: 'image', src: 'assets/cover.webp', tone: 'dark', overlay: 0.2 },
  { kind: 'image-full', src: 'assets/cover.webp', tone: 'light', fit: 'contain' },
  { kind: 'video', src: 'clips/intro.mp4' },
  { kind: 'video-full', src: 'clips/intro.webm', tone: 'light', overlay: 0.8 },
  { kind: 'video', src: 'https://media.example.com/a.mp4', tone: 'dark', overlay: 0.9 },
];

const HEX_SPECS: DeckBackground[] = [
  '#000000',
  '#ffffff',
  '#777777',
  '#808080',
  '#3b82f6',
  '#ff0000',
  '#00FF00',
  '#ffff00',
  '#7f7f7f',
].map((color) => ({ kind: 'solid', color }));

/** Everything text sits on, re-derived from the layers (finer gradient sampling than the resolver). */
function surfacesUnderText(resolved: ResolvedDeckBackground): string[] {
  let behind: string[] = [];
  let alpha = 0;
  let scrimColor = '#000000';
  for (const layer of resolved.layers) {
    if (layer.type === 'color') behind = [layer.color];
    else if (layer.type === 'gradient') behind = sampleGradient(layer.stops, 64);
    else if (layer.type === 'pattern') behind = [layer.color, layer.ink];
    else if (layer.type === 'media') behind = ['#000000', '#ffffff'];
    else {
      alpha = layer.alpha;
      scrimColor = layer.color;
    }
  }
  return alpha > 0 ? behind.map((color) => compositeOver(color, scrimColor, alpha)) : behind;
}

function assertReadable(resolved: ResolvedDeckBackground, label: string): void {
  for (const surface of surfacesUnderText(resolved)) {
    expect(
      contrastRatio(resolved.textColor, surface),
      `${label}: ${resolved.textColor} on ${surface}`
    ).toBeGreaterThanOrEqual(DECK_TEXT_CONTRAST_MIN);
  }
  expect(resolved.contrast, label).toBeGreaterThanOrEqual(DECK_TEXT_CONTRAST_MIN);
  expect(resolved.scrim, label).toBeGreaterThanOrEqual(0);
  expect(resolved.scrim, label).toBeLessThanOrEqual(DECK_SCRIM_MAX);
  expect(Math.round(resolved.scrim * 20) / 20, `${label}: 0.05 grid`).toBe(resolved.scrim);
  expect(resolved.layers.some((layer) => layer.type === 'scrim')).toBe(resolved.scrim > 0);
}

describe('contrast math', () => {
  it('parses hex colors and refuses everything else', () => {
    const cases: [unknown, readonly number[] | null][] = [
      ['#ffffff', [255, 255, 255]],
      ['#FFF', [255, 255, 255]],
      [' #0a0B0c ', [10, 11, 12]],
      ['#12345', null],
      ['#1234567', null],
      ['ffffff', null],
      ['oklch(0.5 0.1 200)', null],
      ['#ggg', null],
      [12, null],
      [null, null],
      ['#fff'.padEnd(10_000, ' '), null],
    ];
    for (const [input, expected] of cases) expect(parseHexColor(input)).toEqual(expected);
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
  });

  it('matches the WCAG reference ratios', () => {
    const cases: [string, string, number][] = [
      ['#000000', '#ffffff', 21],
      ['#ffffff', '#ffffff', 1],
      ['#777777', '#ffffff', 4.48],
      ['#767676', '#ffffff', 4.54],
      ['#0000ff', '#ffffff', 8.59],
      ['#ff0000', '#ffffff', 4],
    ];
    for (const [a, b, ratio] of cases) {
      expect(contrastRatio(a, b)).toBeCloseTo(ratio, 2);
      expect(contrastRatio(b, a)).toBe(contrastRatio(a, b));
    }
    expect(relativeLuminance('#000')).toBe(0);
    expect(relativeLuminance('#fff')).toBe(1);
    expect(() => relativeLuminance('red')).toThrow(TypeError);
  });

  it('composites in sRGB and reads rgb()/rgba() over a base', () => {
    expect(compositeOver('#ffffff', '#000000', 0.5)).toBe('#808080');
    expect(compositeOver('#ffffff', '#000000', 2)).toBe('#000000');
    expect(compositeOver('#ffffff', '#000000', Number.NaN)).toBe('#ffffff');
    expect(opaqueColor('rgba(255, 255, 255, 0.1)', '#000000')).toBe('#1a1a1a');
    expect(opaqueColor('rgb(0 0 0 / 50%)', '#ffffff')).toBe('#808080');
    expect(opaqueColor('rgb(10, 20, 30)', '#ffffff')).toBe('#0a141e');
    for (const bad of ['url(x)', 'var(--x)', 'oklch(0.5 0.1 1)', 'rgb(1,2)', '', 7]) {
      expect(opaqueColor(bad, '#ffffff'), String(bad)).toBeNull();
    }
  });

  it('steps the scrim on a 0.05 grid and never weakens an author overlay', () => {
    const cases: [number, number][] = [
      [0, 0],
      [-1, 0],
      [Number.NaN, 0],
      [0.05, 1],
      [0.051, 2],
      [0.33, 7],
      [0.9, 18],
      [5, 18],
    ];
    for (const [alpha, step] of cases) expect(scrimStepFor(alpha), String(alpha)).toBe(step);
    // White ink over a white field needs a black scrim; the lowest step that clears 4.5:1.
    const choice = chooseInk(
      ['#ffffff'],
      { light: '#ffffff', dark: '#ffffff' },
      { forced: 'light' }
    );
    expect(choice.scrim).toBeGreaterThan(0);
    const lower = Math.round((choice.scrim - 0.05) * 100) / 100;
    expect(contrastRatio('#ffffff', compositeOver('#ffffff', '#000000', lower))).toBeLessThan(4.5);
    expect(
      contrastRatio('#ffffff', compositeOver('#ffffff', '#000000', choice.scrim))
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('text contrast on every background', () => {
  it('reaches AA for every preset, media spec and hex color, on every sample palette', () => {
    let checked = 0;
    for (const [name, palette] of Object.entries(PALETTES)) {
      for (const background of [...DECK_BACKGROUND_PRESET_IDS, ...MEDIA_SPECS, ...HEX_SPECS]) {
        const label = `${name}/${JSON.stringify(background)}`;
        const resolved = resolveDeckBackground(background, palette);
        assertReadable(resolved, label);
        expect(
          resolved.issues.filter((issue) => issue.severity === 'error'),
          label
        ).toEqual([]);
        checked++;
      }
    }
    expect(checked).toBe(
      Object.keys(PALETTES).length * (13 + MEDIA_SPECS.length + HEX_SPECS.length)
    );
  });

  it('holds for a raised floor (AAA, 7:1)', () => {
    for (const palette of Object.values(PALETTES)) {
      for (const background of [...DECK_BACKGROUND_PRESET_IDS, ...MEDIA_SPECS]) {
        const resolved = resolveDeckBackground(background, palette, { minimumContrast: 7 });
        expect(resolved.contrast).toBeGreaterThanOrEqual(7);
      }
    }
    // A floor below AA is ignored, never applied.
    const weak = resolveDeckBackground(
      { kind: 'solid', color: '#777777' },
      PALETTES['neutral-light'] as DeckBackgroundPalette,
      { minimumContrast: 1 }
    );
    expect(weak.contrast).toBeGreaterThanOrEqual(4.5);
  });

  it('puts light text over a dark scrim on media unless the media is declared light', () => {
    for (const palette of Object.values(PALETTES)) {
      const dark = resolveDeckBackground({ kind: 'image', src: 'assets/a.png' }, palette);
      expect(dark.textTone).toBe('light');
      expect(dark.scrimColor).toBe('#000000');
      expect(dark.scrim).toBeGreaterThan(0);
      const light = resolveDeckBackground({ kind: 'video', src: 'v.mp4', tone: 'light' }, palette);
      expect(light.textTone).toBe('dark');
      expect(light.scrimColor).toBe('#ffffff');
    }
  });

  it('only lets an author overlay strengthen the scrim', () => {
    const palette = PALETTES['violet-dark'] as DeckBackgroundPalette;
    const minimum = resolveDeckBackground({ kind: 'video', src: 'v.mp4' }, palette).scrim;
    expect(resolveDeckBackground({ kind: 'video', src: 'v.mp4', overlay: 0 }, palette).scrim).toBe(
      minimum
    );
    expect(
      resolveDeckBackground({ kind: 'video', src: 'v.mp4', overlay: 0.83 }, palette).scrim
    ).toBe(0.85);
    expect(
      resolveDeckBackground({ kind: 'video', src: 'v.mp4', overlay: 0.9 }, palette).scrim
    ).toBe(0.9);
  });

  it('needs no scrim on the plain theme backgrounds, and inverts the tone on solid-inverse', () => {
    for (const [name, palette] of Object.entries(PALETTES)) {
      if (name === 'mid-gray') continue;
      const solid = resolveDeckBackground('solid-color', palette);
      const inverse = resolveDeckBackground('solid-inverse', palette);
      expect(solid.scrim, name).toBe(0);
      expect(inverse.scrim, name).toBe(0);
      expect(inverse.textTone, name).not.toBe(solid.textTone);
      // On-theme text: the theme foreground on its own background.
      expect(solid.textColor, name).toBe(normalizeHex(palette.foreground));
    }
  });

  it('picks the readable tone for hex colors without a scrim', () => {
    const palette = PALETTES['neutral-light'] as DeckBackgroundPalette;
    const cases: [string, 'light' | 'dark'][] = [
      ['#000000', 'light'],
      ['#ffffff', 'dark'],
      ['#1e3a8a', 'light'],
      ['#fde047', 'dark'],
      ['#808080', 'dark'],
    ];
    for (const [color, tone] of cases) {
      const resolved = resolveDeckBackground({ kind: 'solid', color }, palette);
      expect(resolved.textTone, color).toBe(tone);
      expect(resolved.scrim, color).toBe(0);
      expect(resolved.cssVars['--tx-deck-bg-color']).toBe(color);
    }
    expect(
      resolveDeckBackground({ kind: 'solid', color: '#ABCDEF' }, palette).cssVars[
        '--tx-deck-bg-color'
      ]
    ).toBe('#abcdef');
  });

  it('fades a pattern border as dark as the text until text reads on the lines', () => {
    const base = PALETTES['neutral-light'] as DeckBackgroundPalette;
    const palette = { ...base, border: base.foreground };
    for (const preset of ['pattern-dots', 'pattern-grid'] as const) {
      const resolved = resolveDeckBackground(preset, palette);
      const pattern = resolved.layers.find((layer) => layer.type === 'pattern');
      expect(pattern?.type === 'pattern' && pattern.ink).not.toBe(palette.border);
      expect(resolved.scrim).toBe(0);
      assertReadable(resolved, preset);
    }
    // A readable border is kept as is.
    const kept = resolveDeckBackground('pattern-grid', base);
    expect(kept.cssVars['--tx-deck-bg-pattern-ink']).toBe(base.border);
  });
});

describe('resolved output', () => {
  const palette = PALETTES['violet-light'] as DeckBackgroundPalette;

  it('resolves every preset to its spec kind, preset id and layer stack', () => {
    expect(DECK_BACKGROUND_PRESET_IDS).toHaveLength(13);
    expect([...DECK_BACKGROUND_PRESET_IDS].sort()).toEqual(
      Object.keys(DECK_BACKGROUND_PRESETS).sort()
    );
    for (const id of DECK_BACKGROUND_PRESET_IDS) {
      const resolved = resolveDeckBackground(id, palette);
      const spec = DECK_BACKGROUND_PRESETS[id];
      expect(resolved.preset).toBe(id);
      expect(resolved.kind).toBe(spec.kind);
      expect(resolved.layers[0]?.type).toBe('color');
      expect(resolved.issues).toEqual([]);
      if (spec.kind !== 'solid') expect(resolved.layers[1]?.type).toBe(spec.kind);
      expect(validate(deckBackgroundSpec, spec).ok, id).toBe(true);
    }
    expect(resolveDeckBackground(undefined, palette).preset).toBe('solid-color');
    const gradient = resolveDeckBackground(
      { kind: 'gradient', gradient: 'brand', angle: 90 },
      palette
    );
    expect(gradient.layers[1]).toEqual({
      type: 'gradient',
      angle: 90,
      stops: ['#6d28d9', '#0ea5e9'],
    });
    expect(gradient.cssVars['--tx-deck-bg-gradient']).toBe(
      'linear-gradient(90deg, #6d28d9, #0ea5e9)'
    );
  });

  it('marks video muted, looping, inline and autoplaying', () => {
    const video = resolveDeckBackground(
      { kind: 'video-full', src: 'clips/a.mp4', poster: 'assets/p.webp', position: 'top' },
      palette
    );
    expect(video.layers[1]).toEqual({
      type: 'media',
      media: 'video',
      src: 'clips/a.mp4',
      full: true,
      poster: 'assets/p.webp',
      fit: 'cover',
      position: 'top',
      muted: true,
      autoplay: true,
      loop: true,
      playsInline: true,
    });
    const image = resolveDeckBackground(
      { kind: 'image', src: 'a.png', alt: 'Team', fit: 'contain' },
      palette
    );
    expect(image.layers[1]).toEqual({
      type: 'media',
      media: 'image',
      src: 'a.png',
      full: false,
      alt: 'Team',
      fit: 'contain',
      position: 'center',
    });
  });

  it('names every CSS variable --tx-deck-bg-* and builds values only from computed data', () => {
    const safe =
      /^(#[0-9a-f]{6}|transparent|light|dark|dots|grid|cover|contain|center|top|bottom|left|right|0(\.\d+)?|linear-gradient\(\d{1,3}deg(, #[0-9a-f]{6})+\))$/;
    for (const p of Object.values(PALETTES)) {
      for (const background of [...DECK_BACKGROUND_PRESET_IDS, ...MEDIA_SPECS, ...HEX_SPECS]) {
        const resolved = resolveDeckBackground(background, p);
        for (const [name, value] of Object.entries(resolved.cssVars)) {
          expect(name).toMatch(/^--tx-deck-bg-[a-z]+(-[a-z]+)*$/);
          expect(value, `${name}=${value}`).toMatch(safe);
        }
        const text = JSON.stringify(resolved.cssVars);
        expect(text).not.toContain('url(');
        expect(text).not.toContain('--py-');
      }
    }
  });

  it('is deterministic and leaves its inputs untouched', () => {
    const frozen = Object.freeze({ ...palette });
    for (const background of [...DECK_BACKGROUND_PRESET_IDS, ...MEDIA_SPECS]) {
      expect(resolveDeckBackground(background, frozen)).toEqual(
        resolveDeckBackground(background, frozen)
      );
    }
    expect(Object.isFrozen(DECK_BACKGROUND_PRESETS['solid-color'])).toBe(true);
  });
});

describe('background schema', () => {
  const codesOf = (input: unknown) =>
    validate(deckBackground, input).issues.map((i) => `${i.code} ${i.jsonPath}`);

  it('accepts every preset and spec at its boundaries', () => {
    const good: unknown[] = [
      ...DECK_BACKGROUND_PRESET_IDS,
      ...MEDIA_SPECS,
      ...HEX_SPECS,
      { kind: 'solid' },
      { kind: 'solid', token: 'inverse' },
      { kind: 'gradient', gradient: 'mist', angle: 0 },
      { kind: 'gradient', gradient: 'dusk', angle: 359 },
      { kind: 'pattern', pattern: 'grid' },
      { kind: 'image', src: 'a.png', overlay: 0 },
      { kind: 'image', src: 'a.png', overlay: 0.9, alt: 'x'.repeat(200) },
      { kind: 'image', src: 'avatar:av-012' },
      { kind: 'image', src: 'data:image/png;base64,iVBORw0KGgo=' },
      { kind: 'video', src: 'data:video/mp4;base64,AAAA', poster: 'avatar:av-001' },
    ];
    for (const value of good) expect(codesOf(value), JSON.stringify(value)).toEqual([]);
  });

  it('refuses unknown presets and kinds, bad values and unknown keys with stable codes', () => {
    const cases: [unknown, string[]][] = [
      ['gradient-rainbow', ['unknown-background $']],
      ['iframe', ['unknown-background $']],
      ['__proto__', ['unknown-background $']],
      [{ kind: 'iframe', src: 'https://example.com' }, ['unknown-background $.kind']],
      [{ kind: 'solid', token: 'chart1' }, ['enum $.token']],
      [{ kind: 'solid', token: 'primary', color: '#ffffff' }, ['solid-conflict $.color']],
      [{ kind: 'solid', color: 'red' }, ['pattern $.color']],
      [{ kind: 'solid', color: '#fff' }, ['pattern $.color']],
      [{ kind: 'solid', color: '#ffffff; background:url(x)' }, ['too-long $.color']],
      [{ kind: 'gradient', gradient: 'rainbow' }, ['enum $.gradient']],
      [{ kind: 'gradient', gradient: 'brand', angle: 360 }, ['out-of-range $.angle']],
      [{ kind: 'gradient', gradient: 'brand', angle: -1 }, ['out-of-range $.angle']],
      [{ kind: 'gradient', gradient: 'brand', angle: 45.5 }, ['not-integer $.angle']],
      [{ kind: 'image', src: 'a.png', overlay: 0.95 }, ['out-of-range $.overlay']],
      [{ kind: 'image', src: 'a.png', overlay: -0.1 }, ['out-of-range $.overlay']],
      [
        { kind: 'image', src: 'a.png', overlay: Number.POSITIVE_INFINITY },
        ['not-finite $.overlay'],
      ],
      [{ kind: 'image', src: 'a.png', alt: 'x'.repeat(201) }, ['too-long $.alt']],
      [{ kind: 'image', src: 'a.png', alt: 'one\ntwo' }, ['unsafe-text $.alt']],
      [{ kind: 'image', src: 'a.png', style: 'background:url(x)' }, ['unknown-key $.style']],
      [{ kind: 'image', src: 'a.png', fit: 'fill' }, ['enum $.fit']],
      [{ kind: 'video', src: 'v.mp4', fit: 'cover' }, ['unknown-key $.fit']],
      [{ kind: 'image', src: 'javascript:alert(1)' }, ['pattern $.src']],
      [{ kind: 'image', src: '../secret.png' }, ['pattern $.src']],
      [{ kind: 'image', src: 'assets/logo.svg' }, ['pattern $.src']],
      [{ kind: 'image', src: 'data:video/mp4;base64,AAAA' }, ['media-kind $.src']],
      [{ kind: 'video', src: 'avatar:av-001' }, ['media-kind $.src']],
      [
        { kind: 'video', src: 'v.mp4', poster: 'data:video/mp4;base64,AAAA' },
        ['media-kind $.poster'],
      ],
      [{ kind: 'image' }, ['required $.src']],
      [42, ['invalid-type $']],
      [null, ['invalid-type $']],
    ];
    for (const [input, expected] of cases)
      expect(codesOf(input), JSON.stringify(input)).toEqual(expected);
    expect(isDeckBackgroundPreset('constructor')).toBe(false);
    expect(isDeckBackgroundPreset('pattern-dots')).toBe(true);
  });

  it('exports a JSON Schema that lists the presets and the spec kinds', () => {
    const text = JSON.stringify(toJsonSchema(deckBackground));
    for (const id of DECK_BACKGROUND_PRESET_IDS) expect(text).toContain(`"${id}"`);
    for (const kind of [
      'solid',
      'gradient',
      'pattern',
      'image',
      'image-full',
      'video',
      'video-full',
    ]) {
      expect(text).toContain(`"${kind}"`);
    }
  });
});

describe('hostile inputs to the resolver', () => {
  const palette = PALETTES['neutral-light'] as DeckBackgroundPalette;

  it('never throws: invalid backgrounds fall back to solid-color with the validation issues', () => {
    const hostile: unknown[] = [
      'gradient-rainbow',
      'url(https://example.com/x.png)',
      { kind: 'iframe', src: 'https://example.com' },
      { kind: 'solid', color: 'red;}body{display:none' },
      { kind: 'gradient', gradient: '__proto__' },
      { kind: 'image', src: 'javascript:alert(1)' },
      JSON.parse('{"kind":"solid","__proto__":{"color":"#000000"}}'),
      Object.create({ kind: 'solid' }),
      [],
      42,
      null,
    ];
    for (const input of hostile) {
      const resolved = resolveDeckBackground(input, palette, {
        path: ['slides', 2, 'background'],
        slideId: 'intro',
      });
      expect(resolved.preset, JSON.stringify(input)).toBe('solid-color');
      expect(resolved.issues.length, JSON.stringify(input)).toBeGreaterThan(0);
      expect(resolved.issues.every((issue) => issue.slideId === 'intro')).toBe(true);
      expect(resolved.issues[0]?.jsonPath.startsWith('$.slides[2].background')).toBe(true);
      assertReadable(resolved, JSON.stringify(input));
    }
    expect(resolveDeckBackground('gradient-rainbow', palette).issues.map((i) => i.code)).toEqual([
      BACKGROUND_CODES.unknownBackground,
    ]);
  });

  it('replaces unreadable palette colors, warns, and still guarantees contrast', () => {
    const broken = {
      ...palette,
      background: 'oklch(0.98 0 0)',
      foreground: 'var(--x)',
      primary: 'url(javascript:alert(1))',
      border: 12 as unknown as string,
      inverse: 'nope',
    };
    for (const background of [...DECK_BACKGROUND_PRESET_IDS, ...MEDIA_SPECS]) {
      const resolved = resolveDeckBackground(background, broken);
      assertReadable(resolved, String(background));
      expect(
        resolved.issues.map((issue) => `${issue.code} ${issue.severity} ${issue.jsonPath}`)
      ).toEqual([
        'invalid-palette-color warning $.palette.background',
        'invalid-palette-color warning $.palette.foreground',
        'invalid-palette-color warning $.palette.primary',
        'invalid-palette-color warning $.palette.border',
        'invalid-palette-color warning $.palette.inverse',
      ]);
      expect(JSON.stringify(resolved)).not.toMatch(/javascript|var\(|oklch/);
    }
    const empty = resolveDeckBackground('solid-primary', {} as DeckBackgroundPalette);
    assertReadable(empty, 'empty palette');
    expect(empty.issues).toHaveLength(11);
  });
});
