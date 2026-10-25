// @vitest-environment node
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { SEMANTIC_ROLES, TX_PREFIX } from '../src/contract/index.ts';
import {
  renderThemeInlineBlock,
  TAILWIND_PRESET_PACKAGE_PATH,
  TAILWIND_THEME_ENTRIES,
  TAILWIND_UTILITIES,
  tailwindPresetCssHref,
  themeEntryValue,
} from '../src/tailwind/index.ts';

const presetCss = readFileSync(
  new URL('../src/tailwind/preset.css', import.meta.url),
  'utf8'
) as string;
/** Extract `@theme inline { … }` body, respecting nested braces. */
function themeInlineBody(css: string): string {
  const start = css.indexOf('@theme inline');
  expect(start).toBeGreaterThan(-1);
  const brace = css.indexOf('{', start);
  expect(brace).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = brace; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(brace + 1, i);
    }
  }
  throw new Error('unclosed @theme inline block');
}

describe('Tailwind 4 preset contract (T-tokens-tailwind)', () => {
  it('exposes the package CSS path and a resolvable file href', () => {
    expect(TAILWIND_PRESET_PACKAGE_PATH).toBe('@texuli/tokens/tailwind/preset.css');
    expect(tailwindPresetCssHref()).toMatch(/preset\.css$/);
    expect(presetCss.length).toBeGreaterThan(500);
  });

  it('declares a dark custom-variant for data-tx-mode and .dark', () => {
    expect(presetCss).toMatch(/@custom-variant\s+dark/);
    expect(presetCss).toContain('data-tx-mode');
    expect(presetCss).toContain('.dark');
  });

  it('maps every theme entry to a --tx-* token (or density/radius calc)', () => {
    for (const entry of TAILWIND_THEME_ENTRIES) {
      expect(entry.tokenVar.startsWith(TX_PREFIX), entry.themeVar).toBe(true);
      const value = themeEntryValue(entry);
      expect(value.includes('--tx-') || value.includes('tx-density'), entry.themeVar).toBe(true);
    }
  });

  it('covers every semantic role as a Tailwind color', () => {
    for (const role of SEMANTIC_ROLES) {
      const kebab = role
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
      const themeVar = `--color-${kebab}`;
      const found = TAILWIND_THEME_ENTRIES.find((e) => e.themeVar === themeVar);
      expect(found, themeVar).toBeDefined();
      expect(presetCss).toContain(`${themeVar}:`);
    }
  });

  it('keeps the CSS @theme block aligned with the TypeScript map', () => {
    const body = themeInlineBody(presetCss).replace(/\/\*[\s\S]*?\*\//g, ' ');
    const declarations = new Map<string, string>();
    for (const chunk of body.split(';')) {
      const trimmed = chunk.replace(/\s+/g, ' ').trim();
      const match = /^(--[a-z0-9-]+):\s*(.+)$/i.exec(trimmed);
      if (match?.[1] && match[2]) declarations.set(match[1], match[2]);
    }
    expect(declarations.size).toBeGreaterThan(40);
    for (const entry of TAILWIND_THEME_ENTRIES) {
      const value = declarations.get(entry.themeVar);
      expect(value, entry.themeVar).toBeTruthy();
      if (entry.themeVar === '--spacing') {
        expect(value).toContain('--tx-density');
        continue;
      }
      if (entry.themeVar.startsWith('--radius-')) {
        expect(value).toContain('--tx-radius');
        continue;
      }
      expect(value).toContain(entry.tokenVar);
    }
  });

  it('renderThemeInlineBlock emits every mapped theme var', () => {
    const block = renderThemeInlineBlock();
    for (const entry of TAILWIND_THEME_ENTRIES) {
      expect(block).toContain(entry.themeVar);
    }
  });

  it('registers logical safe-area and app utilities (no physical pl/pr-safe)', () => {
    for (const name of TAILWIND_UTILITIES) {
      expect(presetCss).toContain(`@utility ${name}`);
    }
    expect(presetCss).toContain('padding-inline-start');
    expect(presetCss).toContain('padding-block-start');
    expect(presetCss).toContain('block-size');
    expect(presetCss).not.toMatch(/@utility pl-safe/);
    expect(presetCss).not.toMatch(/@utility pr-safe/);
    expect(presetCss).toContain('--tx-safe-area-inline-start');
    expect(presetCss).toMatch(/:dir\(rtl\)/);
  });

  it('does not hard-code product colors; utilities bind to tokens only', () => {
    expect(presetCss).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(presetCss).not.toContain('--py-');
  });

  it('stays within the base CSS gzip budget contribution (≤ 6 KB with room for base)', () => {
    const gzip = gzipSync(presetCss);
    expect(gzip.length).toBeLessThan(6 * 1024);
    expect(gzip.length).toBeGreaterThan(200);
  });
});
