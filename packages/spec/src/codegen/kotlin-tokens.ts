/**
 * Kotlin design tokens (ADR-024): a compiled design system's values as a
 * Kotlin source file, so the native twin paints with the same colors,
 * fonts, radius and spacing as the web. The input is plain resolved data
 * (colors already sRGB hex, lengths in pixels), which a build step makes
 * from `compileDesignSystem` in `@texuli/tokens`; this module never
 * imports the compiler, so `@texuli/spec` stays at L0. Deterministic: the
 * same input gives byte-identical output. Internal for now: only
 * `scripts/design-tokens.ts` uses it, and it is not exported from
 * `@texuli/spec/codegen` (that entry is at its size budget; a public
 * subpath is planned).
 */
import { kotlinString } from './kotlin.ts';

/** The color roles a token set carries, in output order (camelCase of `--tx-<role>`). */
export const KOTLIN_TOKEN_ROLES = Object.freeze([
  'background',
  'foreground',
  'surface',
  'surfaceForeground',
  'muted',
  'mutedForeground',
  'border',
  'borderStrong',
  'ring',
  'primary',
  'primaryForeground',
  'primarySoft',
  'primarySoftForeground',
  'secondary',
  'secondaryForeground',
  'accent',
  'accentForeground',
  'link',
  'destructive',
  'destructiveForeground',
  'destructiveSoft',
  'destructiveSoftForeground',
  'success',
  'successForeground',
  'warning',
  'warningForeground',
  'info',
  'infoForeground',
  'scrim',
] as const);
export type KotlinTokenRole = (typeof KOTLIN_TOKEN_ROLES)[number];

/** The web variable a role reads (`primarySoft` → `--tx-primary-soft`). */
export function tokenVarName(role: string): string {
  return `--tx-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/** One design system, resolved. Colors are `#rrggbb` or `#rrggbbaa`. */
export interface KotlinTokenSystem {
  /** The Kotlin property name (`Default`, `Acme`). */
  name: string;
  id: string;
  version: string;
  /** The compiled design system's hash. */
  hash: string;
  fonts: { sans: string; heading: string; mono: string };
  /** `--tx-radius` and `--tx-space-1`, in pixels (dp on native). */
  radius: number;
  space: number;
  light: Readonly<Record<KotlinTokenRole, string>>;
  dark?: Readonly<Record<KotlinTokenRole, string>> | null;
}

export interface KotlinTokenOptions {
  /** Default `com.texuli.spec.tokens`. */
  packageName?: string;
  /** What produced the input, for the header comment. */
  source?: string;
}

const I = '    ';
const NAME = /^[A-Z][A-Za-z0-9]{0,63}$/;
const PACKAGE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;

/** `#rrggbb` or `#rrggbbaa` as a Kotlin `0xAARRGGBBL` literal. */
export function argbLiteral(color: string): string {
  const match = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(color);
  if (!match) throw new TypeError(`Not an sRGB hex color: ${JSON.stringify(color)}`);
  return `0x${(match[2] ?? 'ff').toUpperCase()}${(match[1] as string).toUpperCase()}L`;
}

function number(value: number, what: string): string {
  if (!Number.isFinite(value) || value < 0 || value > 10_000) {
    throw new TypeError(`${what} is not a length in pixels: ${value}`);
  }
  const text = String(Math.round(value * 1000) / 1000);
  return text.includes('.') ? text : `${text}.0`;
}

function colors(values: Readonly<Record<KotlinTokenRole, string>>, depth: string): string[] {
  return [
    'DesignTokenColors(',
    ...KOTLIN_TOKEN_ROLES.map((role) => `${depth}${I}${role} = ${argbLiteral(values[role])},`),
    `${depth})`,
  ];
}

/**
 * The Kotlin source of `DesignTokenColors`, `DesignTokenSet` and an object
 * holding each system. Throws on input it cannot express (a bad name, a
 * color that is not sRGB hex, a negative length).
 */
export function designTokensToKotlin(
  systems: readonly KotlinTokenSystem[],
  options: KotlinTokenOptions = {}
): string {
  const packageName = options.packageName ?? 'com.texuli.spec.tokens';
  if (!PACKAGE.test(packageName)) throw new TypeError(`Bad package name: ${packageName}`);
  const names = new Set<string>();
  for (const system of systems) {
    if (!NAME.test(system.name) || names.has(system.name)) {
      throw new TypeError(`Bad or repeated token set name: ${JSON.stringify(system.name)}`);
    }
    names.add(system.name);
  }
  const lines: string[] = [
    `// Generated from compiled design systems${options.source ? ` by ${options.source}` : ''}. Do not edit.`,
    '',
    `package ${packageName}`,
    '',
    '/** One mode of a design system: every color as `0xAARRGGBB` sRGB. */',
    'class DesignTokenColors(',
    ...KOTLIN_TOKEN_ROLES.map((role) => `${I}val ${role}: Long,`),
    ') {',
    `${I}/** Each color by the web variable it mirrors (\`--tx-background\` …). */`,
    `${I}val byVar: Map<String, Long>`,
    `${I}${I}get() = mapOf(`,
    ...KOTLIN_TOKEN_ROLES.map(
      (role) => `${I}${I}${I}${kotlinString(tokenVarName(role))} to ${role},`
    ),
    `${I}${I})`,
    '}',
    '',
    '/** A compiled design system: fonts as CSS stacks, lengths in px (dp), colors per mode. */',
    'class DesignTokenSet(',
    `${I}val id: String,`,
    `${I}val version: String,`,
    `${I}val hash: String,`,
    `${I}val fontSans: String,`,
    `${I}val fontHeading: String,`,
    `${I}val fontMono: String,`,
    `${I}val radius: Double,`,
    `${I}val space: Double,`,
    `${I}val light: DesignTokenColors,`,
    `${I}val dark: DesignTokenColors?,`,
    ')',
    '',
    '/** The generated token sets. */',
    'object DesignTokens {',
  ];
  for (const system of systems) {
    const d = `${I}${I}`;
    lines.push(
      `${I}val ${system.name}: DesignTokenSet = DesignTokenSet(`,
      `${d}id = ${kotlinString(system.id)},`,
      `${d}version = ${kotlinString(system.version)},`,
      `${d}hash = ${kotlinString(system.hash)},`,
      `${d}fontSans = ${kotlinString(system.fonts.sans)},`,
      `${d}fontHeading = ${kotlinString(system.fonts.heading)},`,
      `${d}fontMono = ${kotlinString(system.fonts.mono)},`,
      `${d}radius = ${number(system.radius, 'radius')},`,
      `${d}space = ${number(system.space, 'space')},`
    );
    const light = colors(system.light, d);
    lines.push(`${d}light = ${light[0]}`, ...light.slice(1, -1), `${light.at(-1)},`);
    if (system.dark) {
      const dark = colors(system.dark, d);
      lines.push(`${d}dark = ${dark[0]}`, ...dark.slice(1, -1), `${dark.at(-1)},`);
    } else lines.push(`${d}dark = null,`);
    lines.push(`${I})`, '');
  }
  lines.push(
    `${I}/** Every set, in generation order. */`,
    `${I}val all: List<DesignTokenSet>`,
    `${I}${I}get() = listOf(${systems.map((system) => system.name).join(', ')})`,
    '}',
    ''
  );
  return lines.join('\n');
}
