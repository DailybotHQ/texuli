// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildDesignTokens,
  DESIGN_TOKEN_EXTRA_VARS,
  DESIGN_TOKENS_KOTLIN,
  DESIGN_TOKENS_WEB,
  resolveTokenColor,
} from '../scripts/design-tokens.ts';
import {
  argbLiteral,
  designTokensToKotlin,
  KOTLIN_TOKEN_ROLES,
  type KotlinTokenSystem,
  tokenVarName,
} from '../src/codegen/kotlin-tokens.ts';

const colors = (value: string) =>
  Object.fromEntries(KOTLIN_TOKEN_ROLES.map((role) => [role, value])) as KotlinTokenSystem['light'];
const system = (extra: Partial<KotlinTokenSystem> = {}): KotlinTokenSystem => ({
  name: 'Brand',
  id: 'brand',
  version: '1.0.0',
  hash: 'abc',
  fonts: { sans: '"Brand Sans", sans-serif', heading: 'Georgia', mono: 'monospace' },
  radius: 8,
  space: 4,
  light: colors('#112233'),
  ...extra,
});

describe('Kotlin design tokens: codegen', () => {
  it('writes deterministic Kotlin with ARGB literals, escaped strings and one entry per role', () => {
    const kotlin = designTokensToKotlin([
      system({ fonts: { sans: 'A$b"c', heading: 'x', mono: 'y' } }),
    ]);
    expect(designTokensToKotlin([system()])).toBe(designTokensToKotlin([system()]));
    expect(kotlin).toContain('package com.texuli.spec.tokens');
    expect(kotlin).toContain('fontSans = "A\\$b\\"c",');
    expect(kotlin).toContain('background = 0xFF112233L,');
    expect(kotlin).toContain('"--tx-primary-soft" to primarySoft,');
    expect(kotlin).toContain('radius = 8.0,');
    expect(kotlin).toContain('dark = null,');
    expect(kotlin).toContain('get() = listOf(Brand)');
    expect(kotlin.match(/ = 0x[0-9A-F]{8}L,/g)).toHaveLength(KOTLIN_TOKEN_ROLES.length);
  });

  it('refuses input it cannot express', () => {
    expect(argbLiteral('#11223380')).toBe('0x80112233L');
    for (const bad of ['red', '#1234', 'oklch(0.5 0.1 20)', '#11223344;']) {
      expect(() => argbLiteral(bad)).toThrow(TypeError);
    }
    expect(() => designTokensToKotlin([system({ name: 'lower' })])).toThrow(TypeError);
    expect(() => designTokensToKotlin([system(), system()])).toThrow(TypeError);
    expect(() => designTokensToKotlin([system({ name: 'A}; fun x() {' })])).toThrow(TypeError);
    expect(() => designTokensToKotlin([system({ radius: -1 })])).toThrow(TypeError);
    expect(() => designTokensToKotlin([system()], { packageName: 'a;b' })).toThrow(TypeError);
    expect(tokenVarName('destructiveSoftForeground')).toBe('--tx-destructive-soft-foreground');
  });

  it('resolves every compiled color form to sRGB hex (alpha kept)', () => {
    expect(resolveTokenColor('#ABC')).toBe('#aabbcc');
    expect(resolveTokenColor('#11182766')).toBe('#11182766');
    expect(resolveTokenColor('rgb(9 9 11 / 0.32)')).toBe('#09090b52');
    expect(resolveTokenColor('oklch(0.72 0.16 277)')).toMatch(/^#[0-9a-f]{6}$/);
    expect(() => resolveTokenColor('var(--tx-x)')).toThrow(TypeError);
  });
});

describe('Kotlin design tokens: the generated files', () => {
  it('match a fresh compile of the default and acme design systems (no drift)', async () => {
    const build = await buildDesignTokens();
    expect(readFileSync(DESIGN_TOKENS_KOTLIN, 'utf8')).toBe(build.kotlin);
    expect(readFileSync(DESIGN_TOKENS_WEB, 'utf8')).toBe(build.web);
  });

  it('carry, for every role and mode, the Kotlin value of the web variable', () => {
    const kotlin = readFileSync(DESIGN_TOKENS_KOTLIN, 'utf8');
    const web = JSON.parse(readFileSync(DESIGN_TOKENS_WEB, 'utf8')) as {
      systems: { name: string; vars: Record<'light' | 'dark', Record<string, string>> }[];
    };
    expect(web.systems.map((entry) => entry.name)).toEqual(['Default', 'Acme']);
    for (const entry of web.systems) {
      const block = kotlin.slice(kotlin.indexOf(`val ${entry.name}: DesignTokenSet`));
      for (const mode of ['light', 'dark'] as const) {
        const section = block.slice(block.indexOf(`${mode} = DesignTokenColors(`));
        const vars = entry.vars[mode];
        expect(Object.keys(vars)).toHaveLength(
          KOTLIN_TOKEN_ROLES.length + DESIGN_TOKEN_EXTRA_VARS.length
        );
        for (const role of KOTLIN_TOKEN_ROLES) {
          const literal = argbLiteral(resolveTokenColor(vars[tokenVarName(role)] as string));
          expect(section, `${entry.name} ${mode} ${role}`).toContain(`${role} = ${literal},`);
        }
      }
    }
  });
});
