// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  aaSummary,
  buildStudioExport,
  generateStudioTheme,
  normalizeHex,
  roleDefault,
  STUDIO_MOOD_WORDS,
  STUDIO_NEUTRALS,
  setRoleDefault,
  TUNABLE_ROLES,
} from '../../apps/website/src/components/theme-studio/studio.ts';

describe('theme studio helpers', () => {
  it('normalizes hex colors and rejects junk', () => {
    expect(normalizeHex('#2b6ce0')).toBe('#2b6ce0');
    expect(normalizeHex('2b6ce0')).toBe('#2b6ce0');
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('not-a-color')).toBeNull();
    expect(normalizeHex('')).toBeNull();
  });

  it('generates an AA theme from a seed color', () => {
    const result = generateStudioTheme({
      source: 'color',
      seed: '#2b6ce0',
      neutral: 'zinc',
      contrast: 'AA',
      id: 'studio-test',
      name: 'Studio test',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.theme.id).toBe('studio-test');
    expect(result.theme.light.primary.default).toBeTruthy();
    expect(result.theme.dark.primary.default).toBeTruthy();
    const aa = aaSummary(result.theme, 'AA');
    expect(aa.failCount).toBe(0);
  });

  it('generates a theme from mood words', () => {
    expect(STUDIO_MOOD_WORDS).toContain('calm');
    expect(STUDIO_NEUTRALS).toContain('zinc');
    const result = generateStudioTheme({
      source: 'words',
      words: 'calm ocean',
      id: 'mood-test',
      name: 'Mood test',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(aaSummary(result.theme, 'AA').failCount).toBe(0);
  });

  it('rejects empty words and bad seeds', () => {
    expect(generateStudioTheme({ source: 'words', words: '   ' }).ok).toBe(false);
    expect(generateStudioTheme({ source: 'color', seed: 'nope' }).ok).toBe(false);
  });

  it('tunes a role default on one mode and keeps the theme valid', () => {
    const base = generateStudioTheme({
      source: 'color',
      seed: '#16a34a',
      id: 'tune-test',
      name: 'Tune test',
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    expect(TUNABLE_ROLES).toContain('primary');
    const tuned = setRoleDefault(base.theme, 'primary', '#0f766e', ['light']);
    expect(tuned.ok).toBe(true);
    if (!tuned.ok) return;
    expect(roleDefault(tuned.theme, 'light', 'primary').toLowerCase()).toBe('#0f766e');
  });

  it('exports CSS and JSON without echoing secrets beyond theme data', () => {
    const result = generateStudioTheme({
      source: 'color',
      seed: '#e11d48',
      id: 'export-test',
      name: 'Export test',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const css = buildStudioExport('css', result.theme);
    expect(css).toMatch(/@layer tx\.base/);
    expect(css).toMatch(/data-tx-theme='export-test'/);
    expect(css).toMatch(/--tx-primary:/);
    const json = buildStudioExport('json', result.theme);
    const parsed = JSON.parse(json) as { id: string };
    expect(parsed.id).toBe('export-test');
  });

  it('can target AAA generation', () => {
    const result = generateStudioTheme({
      source: 'color',
      seed: '#7c3aed',
      contrast: 'AAA',
      id: 'aaa-test',
      name: 'AAA test',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(aaSummary(result.theme, 'AAA').failCount).toBe(0);
  });
});
