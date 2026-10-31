/**
 * Generate the native twin's design tokens from compiled design systems
 * (ADR-024):
 *   pnpm exec tsx packages/spec/scripts/design-tokens.ts          (write)
 *   pnpm exec tsx packages/spec/scripts/design-tokens.ts --check  (fail on drift)
 *
 * Compiles two documents with `@texuli/tokens/design-system/compile`: the
 * Texuli default (`extends: "texuli:violet"`, what `TexuliTheme` paints
 * with) and the spec's `acme` fixture. It writes:
 * - `native/texuli-spec/.../tokens/DesignTokens.kt`: the Kotlin values
 *   (`designTokensToKotlin`, colors resolved to sRGB);
 * - `native/conformance/fixtures/design-tokens.web.json`: the web compiled
 *   variables those values come from, verbatim, which the Kotlin
 *   conformance test reads to check the native values independently.
 * A build-time script: it may import the compiler, `@texuli/spec` never does.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { compileDesignSystem, resolveDesignSystem } from '@texuli/tokens/design-system/compile';
import { oklchToHex } from '@texuli/tokens/palette';
import {
  designTokensToKotlin,
  KOTLIN_TOKEN_ROLES,
  type KotlinTokenRole,
  type KotlinTokenSystem,
  tokenVarName,
} from '../src/codegen/kotlin-tokens.ts';
import { SPEC_ROOT } from './files.ts';

const REPO = join(SPEC_ROOT, '../..');
export const DESIGN_TOKENS_KOTLIN =
  'native/texuli-spec/src/commonMain/kotlin/com/texuli/spec/tokens/DesignTokens.kt';
export const DESIGN_TOKENS_WEB = 'native/conformance/fixtures/design-tokens.web.json';

/** The variables besides the colors that the Kotlin set mirrors. */
export const DESIGN_TOKEN_EXTRA_VARS = Object.freeze([
  '--tx-font-sans',
  '--tx-font-heading',
  '--tx-font-mono',
  '--tx-radius',
  '--tx-space-1',
]);

const SOURCES: readonly { name: string; document: () => Record<string, unknown> }[] = [
  {
    name: 'Default',
    document: () => ({
      format: 'texuli/design-system',
      formatVersion: 1,
      id: 'texuli',
      version: '1.0.0',
      name: 'Texuli',
      extends: 'texuli:violet',
    }),
  },
  {
    name: 'Acme',
    document: () =>
      JSON.parse(readFileSync(join(SPEC_ROOT, 'fixtures/design-systems/acme.json'), 'utf8')),
  },
];

const alphaHex = (alpha: number) =>
  Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');

/**
 * A compiled color as `#rrggbb` or `#rrggbbaa`: hex as written, `rgb()`, `oklch()`
 * through the tokens engine's gamut-mapped converter (the same one email
 * and print use). Anything else is an error: the compiler emits only these.
 */
export function resolveTokenColor(value: string): string {
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color)) return `#${[...color.slice(1)].map((c) => c + c).join('')}`;
  const oklch =
    /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?)\s*)?\)$/.exec(
      color
    );
  if (oklch) {
    const l = Number(oklch[1]) / (oklch[2] === '%' ? 100 : 1);
    const hex = oklchToHex({ l, c: Number(oklch[3]), h: Number(oklch[4]) });
    if (oklch[5] === undefined) return hex;
    const alpha = Number(oklch[5]) / (oklch[6] === '%' ? 100 : 1);
    return alpha >= 1 ? hex : `${hex}${alphaHex(alpha)}`;
  }
  const rgb =
    /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/.exec(
      color
    );
  if (rgb) {
    const hex = `#${[rgb[1], rgb[2], rgb[3]].map((part) => alphaHex(Number(part) / 255)).join('')}`;
    if (rgb[4] === undefined) return hex;
    const alpha = Number(rgb[4]) / (rgb[5] === '%' ? 100 : 1);
    return alpha >= 1 ? hex : `${hex}${alphaHex(alpha)}`;
  }
  throw new TypeError(`A compiled color the token generator cannot resolve: ${value}`);
}

const pixels = (value: string | undefined, what: string): number => {
  const match = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(value ?? '');
  if (!match) throw new TypeError(`${what} is not a px or rem length: ${value}`);
  return Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
};

export interface DesignTokenBuild {
  kotlin: string;
  web: string;
}

/** Compile every source and build both files (pure apart from reading the fixture). */
export async function buildDesignTokens(): Promise<DesignTokenBuild> {
  const systems: KotlinTokenSystem[] = [];
  const web: unknown[] = [];
  for (const source of SOURCES) {
    const resolved = await resolveDesignSystem(source.document(), { trust: 'developer' });
    if (!resolved.ok) throw new Error(`${source.name}: ${JSON.stringify(resolved.errors)}`);
    const compiled = compileDesignSystem(resolved.document, {
      modes: ['light', 'dark'],
      trust: 'developer',
    });
    if (!compiled.ok) throw new Error(`${source.name}: ${JSON.stringify(compiled.errors)}`);
    const light = compiled.vars.light as Record<string, string>;
    const dark = compiled.vars.dark as Record<string, string> | undefined;
    const roles = (vars: Record<string, string>) =>
      Object.fromEntries(
        KOTLIN_TOKEN_ROLES.map((role) => {
          const value = vars[tokenVarName(role)];
          if (value === undefined) throw new Error(`${source.name}: no ${tokenVarName(role)}`);
          return [role, resolveTokenColor(value)];
        })
      ) as Record<KotlinTokenRole, string>;
    systems.push({
      name: source.name,
      id: compiled.id,
      version: compiled.version,
      hash: compiled.hash,
      fonts: {
        sans: light['--tx-font-sans'] as string,
        heading: light['--tx-font-heading'] as string,
        mono: light['--tx-font-mono'] as string,
      },
      radius: pixels(light['--tx-radius'], '--tx-radius'),
      space: pixels(light['--tx-space-1'], '--tx-space-1'),
      light: roles(light),
      dark: dark ? roles(dark) : null,
    });
    const names = [...KOTLIN_TOKEN_ROLES.map(tokenVarName), ...DESIGN_TOKEN_EXTRA_VARS].sort();
    const pick = (vars: Record<string, string>) =>
      Object.fromEntries(names.map((name) => [name, vars[name]]));
    web.push({
      name: source.name,
      id: compiled.id,
      version: compiled.version,
      hash: compiled.hash,
      vars: { light: pick(light), ...(dark ? { dark: pick(dark) } : {}) },
    });
  }
  const generator = 'packages/spec/scripts/design-tokens.ts';
  return {
    kotlin: designTokensToKotlin(systems, { source: generator }),
    web: `${JSON.stringify({ generator, systems: web }, null, 2)}\n`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  const build = await buildDesignTokens();
  const drift: string[] = [];
  for (const [path, text] of [
    [DESIGN_TOKENS_KOTLIN, build.kotlin],
    [DESIGN_TOKENS_WEB, build.web],
  ] as const) {
    const file = join(REPO, path);
    const current = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
    if (current === text) continue;
    if (check) drift.push(path);
    else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    }
  }
  if (drift.length > 0) {
    console.error(`design tokens drift: ${drift.join(', ')}`);
    process.exit(1);
  }
  console.log(`${check ? 'checked' : 'wrote'} ${DESIGN_TOKENS_KOTLIN} and ${DESIGN_TOKENS_WEB}`);
}
