// @vitest-environment node
/**
 * Library quality gates:
 * - expand meta carries neutral; expand primaries distinct
 * - port seeds match Protoyard/pre-compact originals except documented nudges
 * - named close pairs stay above the dE floor
 * - every theme's primary hue matches its name/meta family
 */
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { defineTheme } from '../src/contract/index.ts';
import { SEMANTIC_ROLES } from '../src/contract/semantic.ts';
import { generateThemeFromSeed } from '../src/generator/seed.ts';
import {
  EXPAND_THEME_LIBRARY_META,
  getFullThemeLibraryMeta,
  loadExpandThemeDefinition,
} from '../src/library-expand/index.ts';
import { buildLibraryTheme } from '../src/library-port/build.ts';
import { familyFromText, hueInFamily } from '../src/library-port/hue-family.ts';
import {
  clearLibraryThemeCache,
  loadLibraryTheme,
  loadLibraryThemeDefinition,
  THEME_LIBRARY_META,
} from '../src/library-port/index.ts';
import {
  LIBRARY_THEME_IDS,
  PORT_SEED_NUDGES,
  PORT_THEME_RECORDS,
} from '../src/library-port/records.ts';
import { parseHex } from '../src/palette/contrast.ts';
import { oklabDistance, rgbToOklch } from '../src/palette/oklch.ts';

/** Expand catalog: min seed OKLab distance between distinct themes. */
const EXPAND_MIN_PRIMARY_DE = 0.02;
/** Port catalog: min built-primary OKLab distance for documented close pairs. */
const PORT_MIN_PRIMARY_DE = 0.04;
const PORT_MATCH_DE = 0.01;

/** Pre-compact Texuli port (field-identical to Protoyard 64 for seeds). */
const ORIGINAL_PORT_REV = '5c682dd^';

function hexOklabDistance(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return Number.POSITIVE_INFINITY;
  return oklabDistance(rgbToOklch(ra), rgbToOklch(rb));
}

function comboKey(seed: string, neutral: string | undefined, mood: readonly string[]): string {
  return `${seed.toLowerCase()}|${neutral ?? ''}|${[...mood].sort().join('+')}`;
}

function loadOriginalPortSeeds(): Map<string, string> {
  const files = execFileSync(
    'git',
    [
      'ls-tree',
      '-r',
      '--name-only',
      ORIGINAL_PORT_REV,
      '--',
      'packages/tokens/src/library-port/themes/',
    ],
    { encoding: 'utf8' }
  )
    .trim()
    .split('\n')
    .filter(Boolean);
  const map = new Map<string, string>();
  for (const file of files) {
    const src = execFileSync('git', ['show', `${ORIGINAL_PORT_REV}:${file}`], { encoding: 'utf8' });
    const id = /id:\s*'([^']+)'/.exec(src)?.[1];
    const seed = /seed:\s*'([^']+)'/.exec(src)?.[1];
    if (id && seed) map.set(id, seed.toLowerCase());
  }
  return map;
}

describe('library expand quality', () => {
  it('carries neutral on every expanded theme meta row', () => {
    expect(EXPAND_THEME_LIBRARY_META.length).toBeGreaterThanOrEqual(140);
    for (const meta of EXPAND_THEME_LIBRARY_META) {
      expect(meta.neutral, meta.id).toBeTruthy();
    }
  });

  it('keeps expand primaries distinct (no duplicate combos; min OKLab dE ≥ 0.02)', async () => {
    const defs = await Promise.all(
      EXPAND_THEME_LIBRARY_META.map((m) => loadExpandThemeDefinition(m.id))
    );
    const combos = new Map<string, string>();
    for (const def of defs) {
      const key = comboKey(def.seed, def.neutral, def.mood ?? []);
      expect(combos.has(key), `duplicate combo ${key} (${def.id} vs ${combos.get(key)})`).toBe(
        false
      );
      combos.set(key, def.id);
      const meta = EXPAND_THEME_LIBRARY_META.find((m) => m.id === def.id);
      expect(meta?.neutral).toBe(def.neutral);
      expect(meta?.seed.toLowerCase()).toBe(def.seed.toLowerCase());
    }

    for (let i = 0; i < defs.length; i += 1) {
      for (let j = i + 1; j < defs.length; j += 1) {
        const distance = hexOklabDistance(defs[i]!.seed, defs[j]!.seed);
        expect(
          distance,
          `${defs[i]!.id} vs ${defs[j]!.id} primary dE ${distance}`
        ).toBeGreaterThanOrEqual(EXPAND_MIN_PRIMARY_DE);
      }
    }
  });

  it('keeps the full catalog at least 200 unique themes', async () => {
    const full = await getFullThemeLibraryMeta();
    expect(full.length).toBeGreaterThanOrEqual(200);
    expect(new Set(full.map((m) => m.id)).size).toBe(full.length);
  });
});

describe('library port identity (FIX-port-identity)', () => {
  const NAMED_PORT_PAIRS = [
    ['health-clinic', 'climate-earth'],
    ['security-vault', 'productivity-minimal'],
  ] as const;

  it('keeps PORT_THEME_RECORDS id order equal to frozen LIBRARY_THEME_IDS', () => {
    expect(LIBRARY_THEME_IDS).toHaveLength(64);
    expect(PORT_THEME_RECORDS.map((r) => r.id)).toEqual([...LIBRARY_THEME_IDS]);
    expect(THEME_LIBRARY_META.map((m) => m.id)).toEqual([...LIBRARY_THEME_IDS]);
    // Spot-check Protoyard positions called out in the regression.
    expect(LIBRARY_THEME_IDS[39]).toBe('fieldwork');
    expect(LIBRARY_THEME_IDS[62]).toBe('graphite');
    expect(LIBRARY_THEME_IDS[63]).toBe('sepia-print');
  });

  it('matches pre-compact original seeds and fields except documented nudges', () => {
    const originals = loadOriginalPortSeeds();
    expect(originals.size).toBe(64);
    expect(PORT_THEME_RECORDS).toHaveLength(64);

    const nudgeById = new Map(PORT_SEED_NUDGES.map((n) => [n.id, n]));
    for (const record of PORT_THEME_RECORDS) {
      const original = originals.get(record.id);
      expect(original, record.id).toBeTruthy();
      const nudge = nudgeById.get(record.id);
      if (nudge) {
        expect(record.seed.toLowerCase()).toBe(nudge.seed.toLowerCase());
        expect(nudge.originalSeed.toLowerCase()).toBe(original);
      } else {
        expect(record.seed.toLowerCase(), record.id).toBe(original);
      }
      const meta = THEME_LIBRARY_META.find((m) => m.id === record.id);
      expect(meta?.seed.toLowerCase()).toBe(record.seed.toLowerCase());
    }

    const prod = PORT_THEME_RECORDS.find((r) => r.id === 'productivity-minimal');
    expect(prod?.seed.toLowerCase()).toBe('#1e293b');
    expect(prod?.neutral, 'productivity-minimal.neutral must stay unset').toBeUndefined();
  });

  it('keeps named close pairs at OKLab dE ≥ 0.04 (seed + built primaries)', () => {
    for (const [leftId, rightId] of NAMED_PORT_PAIRS) {
      const left = PORT_THEME_RECORDS.find((d) => d.id === leftId);
      const right = PORT_THEME_RECORDS.find((d) => d.id === rightId);
      expect(left, leftId).toBeTruthy();
      expect(right, rightId).toBeTruthy();
      expect(hexOklabDistance(left!.seed, right!.seed)).toBeGreaterThanOrEqual(PORT_MIN_PRIMARY_DE);

      const builtL = buildLibraryTheme(left!);
      const builtR = buildLibraryTheme(right!);
      const lightD = hexOklabDistance(builtL.light.primary.default, builtR.light.primary.default);
      expect(
        lightD,
        `named pair ${leftId} ~ ${rightId} light primary dE ${lightD}`
      ).toBeGreaterThanOrEqual(PORT_MIN_PRIMARY_DE);

      // Near-black slate pairs (security-vault / productivity-minimal) share a dual-safe
      // dark primary; seed + light primary already clear the floor. Chromatic pairs
      // must also clear dark.
      const leftO = rgbToOklch(parseHex(left!.seed)!);
      const rightO = rgbToOklch(parseHex(right!.seed)!);
      const nearBlack = leftO.l < 0.32 && rightO.l < 0.32 && leftO.c < 0.08 && rightO.c < 0.08;
      if (!nearBlack) {
        const darkD = hexOklabDistance(builtL.dark.primary.default, builtR.dark.primary.default);
        expect(
          darkD,
          `named pair ${leftId} ~ ${rightId} dark primary dE ${darkD}`
        ).toBeGreaterThanOrEqual(PORT_MIN_PRIMARY_DE);
      }
    }
  });

  it('ported 64: pairwise seed dE ≥ 0.04 except identical seeds and frozen Protoyard near-pairs', () => {
    const originals = loadOriginalPortSeeds();
    const records = PORT_THEME_RECORDS;
    const nudgeIds = new Set(PORT_SEED_NUDGES.map((n) => n.id));
    for (let i = 0; i < records.length; i += 1) {
      for (let j = i + 1; j < records.length; j += 1) {
        const a = records[i]!;
        const b = records[j]!;
        if (a.seed.toLowerCase() === b.seed.toLowerCase()) continue;
        const origA = originals.get(a.id)!;
        const origB = originals.get(b.id)!;
        const origD = hexOklabDistance(origA, origB);
        const now = hexOklabDistance(a.seed, b.seed);
        // Documented close pairs must clear the port floor after nudges.
        const named =
          (a.id === 'health-clinic' && b.id === 'climate-earth') ||
          (a.id === 'climate-earth' && b.id === 'health-clinic') ||
          (a.id === 'security-vault' && b.id === 'productivity-minimal') ||
          (a.id === 'productivity-minimal' && b.id === 'security-vault');
        if (named) {
          expect(now, `${a.id}~${b.id}`).toBeGreaterThanOrEqual(PORT_MIN_PRIMARY_DE);
          continue;
        }
        // Protoyard already had some near seeds (< 0.04); leave those alone unless nudged.
        if (origD < PORT_MIN_PRIMARY_DE && !nudgeIds.has(a.id) && !nudgeIds.has(b.id)) {
          continue;
        }
        expect(
          now,
          `${a.id} vs ${b.id} seed dE ${now} (port floor ${PORT_MIN_PRIMARY_DE})`
        ).toBeGreaterThanOrEqual(PORT_MIN_PRIMARY_DE);
      }
    }
  });

  it('matches generateThemeFromSeed within OKLab dE 0.01 on every hex role (64 ports)', async () => {
    clearLibraryThemeCache();
    for (const meta of THEME_LIBRARY_META) {
      const def = await loadLibraryThemeDefinition(meta.id);
      const built = buildLibraryTheme(def);
      expect(() => defineTheme(built)).not.toThrow();
      const seeded = generateThemeFromSeed({
        id: def.id,
        name: def.name,
        description: def.description,
        seed: def.seed,
        ...(def.secondary ? { secondary: def.secondary } : {}),
        ...(def.neutral ? { neutral: def.neutral } : {}),
        ...(def.contrastLevel === 'AAA' ? { contrast: 'AAA' as const } : {}),
        ...(def.radius !== undefined ? { radius: def.radius } : {}),
        ...(def.density !== undefined ? { density: def.density } : {}),
      });
      expect(built.id).toBe(seeded.id);
      for (const mode of ['light', 'dark'] as const) {
        for (const role of SEMANTIC_ROLES) {
          const a = built[mode][role].default;
          const b = seeded[mode][role].default;
          if (!parseHex(a) || !parseHex(b)) continue;
          const distance = hexOklabDistance(a, b);
          expect(
            distance,
            `${meta.id} ${mode}.${role} dE=${distance} (${a} vs ${b})`
          ).toBeLessThanOrEqual(PORT_MATCH_DE);
        }
      }
      const loaded = await loadLibraryTheme(meta.id);
      expect(loaded.light.primary.default).toBe(built.light.primary.default);
    }
  }, 120_000);
});

describe('library hue family honesty (all 210)', () => {
  it('primary OKLCH hue matches the family declared by id/name color words', async () => {
    const full = await getFullThemeLibraryMeta();
    expect(full.length).toBeGreaterThanOrEqual(200);
    const misses: string[] = [];
    let checked = 0;

    for (const meta of full) {
      // Id first, then display name — never tags/category alone (too noisy).
      const family = familyFromText(meta.id) ?? familyFromText(meta.name);
      if (!family) continue;
      checked += 1;
      const rgb = parseHex(meta.seed);
      if (!rgb) {
        misses.push(`${meta.id}: bad seed ${meta.seed}`);
        continue;
      }
      const { h, c } = rgbToOklch(rgb);
      if (!hueInFamily(h, family, c)) {
        misses.push(
          `${meta.id}: seed ${meta.seed} hue ${h.toFixed(1)} chroma ${c.toFixed(3)} not in family ${family}`
        );
      }
    }

    expect(checked).toBeGreaterThan(80);
    expect(misses, misses.slice(0, 40).join('\n')).toEqual([]);
  });
});
