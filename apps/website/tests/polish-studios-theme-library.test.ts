/**
 * T-82 — theme studio starting points (punch-list rows 2 and 8 support):
 * preset seeds, the featured library themes, and the payload importer that
 * turns a `/theme-data/<id>.json` file into an editable studio theme.
 *
 * The importer is pinned against a real library theme: a full round trip
 * through the explorer payload must preserve every role color, so "start
 * from a library theme" starts from the real palette, not an approximation.
 */

import { SEMANTIC_ROLES, type Theme } from '@texuli/tokens';
import { getFullThemeLibraryMeta, loadFullLibraryTheme } from '@texuli/tokens/library-expand';
import { describe, expect, it } from 'vitest';
import {
  FEATURED_LIBRARY_THEMES,
  generateStudioTheme,
  humanizeThemeId,
  normalizeHex,
  STUDIO_SEED_PRESETS,
  themeFromLibraryPayload,
} from '../src/components/theme-studio/studio.ts';

type PayloadRole = { role: string; default: string; hover?: string; active?: string };

/** The explorer payload shape the studio imports (roles only, as shipped). */
function payloadOf(theme: Theme): unknown {
  const modes = ['light', 'dark'] as const;
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    category: 'test',
    contrastLevel: 'AA',
    ...Object.fromEntries(
      modes.map((mode) => [
        mode,
        {
          mode,
          roles: SEMANTIC_ROLES.map((role) => {
            const value = theme[mode][role];
            const entry: PayloadRole = { role, default: value?.default ?? '#000000' };
            if (value?.hover) entry.hover = value.hover;
            if (value?.active) entry.active = value.active;
            return entry;
          }),
        },
      ])
    ),
  };
}

describe('studio starting points', () => {
  it('offers preset seeds whose hexes all normalize and generate', () => {
    expect(STUDIO_SEED_PRESETS.length).toBeGreaterThanOrEqual(6);
    const labels = new Set(STUDIO_SEED_PRESETS.map((preset) => preset.label));
    expect(labels.size).toBe(STUDIO_SEED_PRESETS.length);
    for (const preset of STUDIO_SEED_PRESETS) {
      expect(normalizeHex(preset.hex)).toBe(preset.hex.toLowerCase());
      const result = generateStudioTheme({
        source: 'color',
        seed: preset.hex,
        contrast: 'AA',
        id: 'seed-preset-test',
        name: preset.label,
      });
      expect(result.ok).toBe(true);
    }
  });

  it('features library themes that exist in the real 210-theme library', async () => {
    const meta = await getFullThemeLibraryMeta();
    const ids = new Set(meta.map((entry) => entry.id));
    // 210 themes as of 2026-10-26; other lanes may grow the library, but it
    // must never silently shrink under the studio's starting points.
    expect(meta.length).toBeGreaterThanOrEqual(210);
    expect(FEATURED_LIBRARY_THEMES.length).toBeLessThanOrEqual(8);
    for (const featured of FEATURED_LIBRARY_THEMES) {
      expect(ids.has(featured.id), `featured id ${featured.id} must exist`).toBe(true);
      expect(featured.category).toBeTruthy();
    }
  });

  it('humanizes theme ids for button labels', () => {
    expect(humanizeThemeId('enterprise-neutral')).toBe('Enterprise Neutral');
    expect(humanizeThemeId('okabe-blue')).toBe('Okabe Blue');
  });
});

describe('themeFromLibraryPayload', () => {
  it('round-trips a real library theme without losing a single role color', async () => {
    const source = await loadFullLibraryTheme('enterprise-neutral');
    const result = themeFromLibraryPayload(payloadOf(source));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.theme.id).toBe('theme-studio');
    expect(result.theme.name).toBe(source.name);
    for (const mode of ['light', 'dark'] as const) {
      for (const role of SEMANTIC_ROLES) {
        expect(result.theme[mode][role]?.default, `${mode}.${role}`).toBe(
          source[mode][role]?.default
        );
        expect(result.theme[mode][role]?.hover, `${mode}.${role} hover`).toBe(
          source[mode][role]?.hover
        );
        expect(result.theme[mode][role]?.active, `${mode}.${role} active`).toBe(
          source[mode][role]?.active
        );
      }
    }
  });

  it('fails closed on junk instead of returning a partial theme', async () => {
    expect(themeFromLibraryPayload(null).ok).toBe(false);
    expect(themeFromLibraryPayload('card').ok).toBe(false);
    expect(themeFromLibraryPayload({}).ok).toBe(false);
    expect(themeFromLibraryPayload({ light: { roles: [] }, dark: { roles: [] } }).ok).toBe(false);

    const source = await loadFullLibraryTheme('enterprise-neutral');
    const payload = payloadOf(source) as { light: { roles: PayloadRole[] } };
    const [dropped, ...rest] = payload.light.roles;
    expect(dropped).toBeTruthy();
    const incomplete = themeFromLibraryPayload({ name: 'Broken', light: { roles: rest } });
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) expect(incomplete.message).toContain('role');
  });

  it('survives a JSON round trip, as a fetched theme file would', async () => {
    const source = await loadFullLibraryTheme('okabe-blue');
    const fetched = JSON.parse(JSON.stringify(payloadOf(source))) as unknown;
    const result = themeFromLibraryPayload(fetched, { name: 'Okabe blue (tuned here)' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.theme.name).toBe('Okabe blue (tuned here)');
    expect(result.theme.light.primary.default).toBe(source.light.primary.default);
  });
});
