/**
 * `@texuli/tokens/design-system/emit` (T-ds-io): deterministic text outputs
 * of a design system. From a compiled design system: scoped CSS
 * (`emitCss`), a Tailwind preset (`emitTailwindPreset`, `…Json`) and the
 * compiled JSON (`emitCompiledJson`). From a document: W3C DTCG
 * (`emitDtcg`, `…Json`), Tokens Studio (`emitTokensStudio`) and a flat role
 * palette (`emitRolePalette`), each the lossless inverse of its importer.
 *
 * Every emitter is pure: the same input (in any key order) gives byte-equal
 * output. Compiled values are written only when they pass the CSS safety
 * rules again (a cached or hand-made compiled object cannot inject CSS); a
 * refused declaration is counted in a comment, never written.
 *
 * A lazy entry: the `@texuli/tokens` root never imports it.
 */

import type { DesignSystem } from '@texuli/spec/design-system';
import { semanticTokenToCssVar } from '../contract/prefix.ts';
import { INTERACTIVE_SEMANTIC_ROLES, SEMANTIC_ROLES } from '../contract/semantic.ts';
import type { CompiledDesignSystem } from './compiler.ts';
import { formatFontStack, splitFontStack } from './from-theme.ts';
import type { DesignSystemMode } from './guarantees.ts';
import type { RolePalette, RolePaletteCharts } from './import.ts';
import { INVISIBLE, isObject, type JsonObject, stableJson } from './io.ts';
import { sortDeep } from './token-formats.ts';

export {
  DESIGN_SYSTEM_EXTENSION,
  emitDtcg,
  emitDtcgJson,
  emitTokensStudio,
} from './token-formats.ts';

const SAFE_NAME = /^--tx-[a-z0-9-]{1,96}$/;
const DOC_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const VERSION = /^[0-9A-Za-z.+-]{1,64}$/;

/**
 * A compiled value safe to write into a stylesheet or a style attribute: no
 * declaration, block, comment or markup characters, no `url()`, `image()`,
 * `expression()` or at-rules, no invisible characters, balanced quotes.
 */
export function isSafeCompiledValue(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return false;
  if (INVISIBLE.test(value) || /[;{}<>\\!`]|\/\*|\*\/|@/.test(value)) return false;
  if (/\b(?:url|image|image-set|expression|element|src)\s*\(/i.test(value)) return false;
  return (value.match(/"/g)?.length ?? 0) % 2 === 0 && (value.match(/'/g)?.length ?? 0) % 2 === 0;
}

const safeEntries = (vars: Readonly<Record<string, unknown>> | undefined) => {
  const entries: [string, string][] = [];
  let skipped = 0;
  if (!isObject(vars as never)) return { entries, skipped };
  for (const name of Object.keys(vars as object).sort()) {
    const value = (vars as Record<string, unknown>)[name];
    if (SAFE_NAME.test(name) && isSafeCompiledValue(value)) entries.push([name, value]);
    else skipped++;
  }
  return { entries, skipped };
};

const SELECTOR = /^[A-Za-z0-9_\-.#:[\]="' >+~*()]{1,200}$/;

/** A selector the CSS emitter accepts: one compound or complex selector, no lists, blocks or comments. */
export function isSafeSelector(selector: string): boolean {
  return (
    typeof selector === 'string' &&
    SELECTOR.test(selector) &&
    !selector.includes('/*') &&
    (selector.match(/"/g)?.length ?? 0) % 2 === 0 &&
    (selector.match(/'/g)?.length ?? 0) % 2 === 0 &&
    (selector.match(/\[/g)?.length ?? 0) === (selector.match(/\]/g)?.length ?? 0)
  );
}

export interface EmitCssOptions {
  /** Defaults to `[data-tx-ds="<id>"]`; `:root` for a global stylesheet. */
  selector?: string;
  /** How dark mode is selected: a `.dark` class (default), `[data-tx-mode="dark"]`, or the media query. */
  dark?: 'class' | 'attribute' | 'media';
  /** Defaults to the compiled modes. */
  modes?: readonly DesignSystemMode[];
}

const darkSelector = (selector: string, dark: 'class' | 'attribute') => {
  const suffix = dark === 'class' ? '.dark' : '[data-tx-mode="dark"]';
  return selector === ':root' ? `:root${suffix}` : `${selector}${suffix},\n${suffix} ${selector}`;
};

/**
 * Scoped CSS custom properties for each compiled mode: light on the
 * selector, dark on the dark selector (or inside the media query). Throws a
 * `TypeError` for a selector {@link isSafeSelector} refuses; unsafe
 * compiled declarations are skipped and counted in a comment.
 */
export function emitCss(compiled: CompiledDesignSystem, options: EmitCssOptions = {}): string {
  const id = typeof compiled.id === 'string' && DOC_ID.test(compiled.id) ? compiled.id : undefined;
  const selector = options.selector ?? (id ? `[data-tx-ds="${id}"]` : '[data-tx-ds]');
  if (!isSafeSelector(selector)) throw new TypeError('The selector is not a safe CSS selector.');
  const dark = options.dark ?? 'class';
  const modes = (options.modes ?? ['light', 'dark']).filter(
    (mode): mode is DesignSystemMode => mode === 'light' || mode === 'dark'
  );
  const version =
    typeof compiled.version === 'string' && VERSION.test(compiled.version)
      ? ` ${compiled.version}`
      : '';
  const blocks: string[] = [`/* Texuli design system${id ? ` ${id}` : ''}${version} */`];
  let skipped = 0;
  for (const mode of ['light', 'dark'] as const) {
    if (!modes.includes(mode) || !compiled.vars?.[mode]) continue;
    const safe = safeEntries(compiled.vars[mode]);
    skipped += safe.skipped;
    const indent = mode === 'dark' && dark === 'media' ? '    ' : '  ';
    const body = safe.entries.map(([name, value]) => `${indent}${name}: ${value};`).join('\n');
    if (mode === 'light') blocks.push(`${selector} {\n${body}\n}`);
    else if (dark === 'media')
      blocks.push(`@media (prefers-color-scheme: dark) {\n  ${selector} {\n${body}\n  }\n}`);
    else blocks.push(`${darkSelector(selector, dark)} {\n${body}\n}`);
  }
  if (skipped > 0) blocks.splice(1, 0, `/* skipped ${skipped} unsafe declarations */`);
  return `${blocks.join('\n\n')}\n`;
}

export interface TailwindPreset {
  theme: {
    extend: {
      colors: Record<string, string>;
      borderRadius: Record<string, string>;
      fontFamily: Record<string, string[]>;
      spacing: Record<string, string>;
      boxShadow: Record<string, string>;
    };
  };
}

export interface EmitTailwindOptions {
  /**
   * `vars` (default): `var(--tx-*)` references, so the scoped CSS from
   * {@link emitCss} drives every mode. `light` or `dark`: that mode's
   * concrete values.
   */
  values?: 'vars' | DesignSystemMode;
}

const COLOR_VARS: ReadonlySet<string> = new Set([
  ...SEMANTIC_ROLES.map((role) => semanticTokenToCssVar(role)),
  ...INTERACTIVE_SEMANTIC_ROLES.flatMap((role) =>
    ['hover', 'active', 'disabled', 'focus'].map((state) => semanticTokenToCssVar(role, state))
  ),
]);

/**
 * A Tailwind preset (`presets: [preset]` in Tailwind 3; the same maps work
 * as Tailwind 4 `@theme` values): semantic, state, chart and status colors,
 * the shape radius steps, the three font stacks, the space steps as
 * `tx-<n>` and the elevation ladder.
 */
export function emitTailwindPreset(
  compiled: CompiledDesignSystem,
  options: EmitTailwindOptions = {}
): TailwindPreset {
  const values = options.values ?? 'vars';
  const source = compiled.vars?.[values === 'dark' ? 'dark' : 'light'] ?? {};
  const { entries } = safeEntries(source);
  const value = (name: string, concrete: string) => (values === 'vars' ? `var(${name})` : concrete);
  const extend: TailwindPreset['theme']['extend'] = {
    colors: {},
    borderRadius: {},
    fontFamily: {},
    spacing: {},
    boxShadow: {},
  };
  for (const [name, concrete] of entries) {
    const key = name.slice('--tx-'.length);
    const radius = /^--tx-shape-radius-([a-z]+)$/.exec(name);
    const font = /^--tx-font-(sans|heading|mono)$/.exec(name);
    const space = /^--tx-space-(\d+)$/.exec(name);
    const elevation = /^--tx-elevation-(\d)$/.exec(name);
    if (COLOR_VARS.has(name) || /^--tx-(?:chart|status)-/.test(name))
      extend.colors[key] = value(name, concrete);
    else if (radius) extend.borderRadius[radius[1] as string] = value(name, concrete);
    else if (name === '--tx-radius') extend.borderRadius.DEFAULT = value(name, concrete);
    else if (font)
      extend.fontFamily[font[1] as string] =
        values === 'vars' ? [`var(${name})`] : splitFontStack(concrete);
    else if (space) extend.spacing[`tx-${space[1]}`] = value(name, concrete);
    else if (elevation) extend.boxShadow[`elevation-${elevation[1]}`] = value(name, concrete);
  }
  return sortDeep({ theme: { extend } });
}

/** {@link emitTailwindPreset} as JSON text. */
export function emitTailwindPresetJson(
  compiled: CompiledDesignSystem,
  options: EmitTailwindOptions = {}
): string {
  return `${JSON.stringify(emitTailwindPreset(compiled, options), null, 2)}\n`;
}

/** The compiled design system as JSON text, keys sorted at every depth. */
export function emitCompiledJson(compiled: CompiledDesignSystem): string {
  return stableJson(compiled);
}

export interface EmitRolePaletteOptions {
  /** The host's format tag to write (`protoyard-theme/v1`). */
  format?: string;
  /** Role keys in camelCase (default) or kebab-case. */
  roleCase?: 'camel' | 'kebab';
}

const kebab = (role: string) => role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const num = (n: number) => String(Number(n.toFixed(4)));

/**
 * A document as a flat role palette, the inverse of `importRolePalette`:
 * role pins per mode, the three font stacks as CSS lists, the radius in rem,
 * density, the style knobs and the chart palettes. Fields a flat palette
 * cannot hold (pins, typography roles, components, variants…) are left out.
 */
export function emitRolePalette(
  doc: DesignSystem,
  options: EmitRolePaletteOptions = {}
): RolePalette {
  const roles = (map: Record<string, string> | undefined) =>
    Object.fromEntries(
      Object.entries(map ?? {}).map(([role, color]) => [
        options.roleCase === 'kebab' ? kebab(role) : role,
        color,
      ])
    );
  const light = (doc.color?.roles?.light ?? {}) as Record<string, string>;
  const out: RolePalette = {
    ...(options.format ? { format: options.format } : {}),
    id: doc.id,
    name: doc.name,
    ...(doc.description ? { description: doc.description } : {}),
    ...(doc.version !== '1.0.0' ? { version: doc.version } : {}),
    ...(doc.color?.brand?.seed && doc.color.brand.seed !== light.primary
      ? { seed: doc.color.brand.seed }
      : {}),
    light: roles(light),
  };
  if (doc.color?.roles?.dark) out.dark = roles(doc.color.roles.dark as Record<string, string>);
  const families = doc.typography?.families;
  if (families?.sans) out.fontFamily = formatFontStack(families.sans.stack);
  if (families?.heading) out.fontFamilyHeading = formatFontStack(families.heading.stack);
  if (families?.mono) out.fontFamilyMono = formatFontStack(families.mono.stack);
  if (doc.shape?.radius !== undefined) out.radius = `${num(doc.shape.radius / 16)}rem`;
  if (doc.space?.density !== undefined) out.density = doc.space.density;
  const style: NonNullable<RolePalette['style']> = {
    ...(doc.surface?.style ? { surface: doc.surface.style } : {}),
    ...(doc.accessibility?.focus ? { focusRing: doc.accessibility.focus } : {}),
    ...(doc.elevation?.style ? { elevation: doc.elevation.style } : {}),
    ...(doc.motion?.personality ? { motion: doc.motion.personality } : {}),
  };
  if (Object.keys(style).length > 0) out.style = style;
  const dataViz = doc.color?.dataViz;
  if (dataViz?.light || dataViz?.dark) {
    const charts: NonNullable<RolePalette['charts']> = {};
    for (const mode of ['light', 'dark'] as const) {
      const palette = dataViz[mode];
      if (palette) charts[mode] = JSON.parse(JSON.stringify(palette)) as RolePaletteCharts;
    }
    out.charts = charts;
  }
  return out;
}

export type { JsonObject };
