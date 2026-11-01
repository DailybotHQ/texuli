/**
 * `@texuli/tokens/design-system/import` (T-ds-io): turn what a company
 * already has into a valid design-system document, plus warnings. Every
 * importer is pure, synchronous and deterministic, and never throws: input
 * it cannot read is `{ ok: false, errors }` with a code (`invalid-input`,
 * `input-limit`, or the spec's validation codes); each value it refuses or
 * cannot place is a warning, and the import goes on without it. Results are
 * validated at `trust: 'untrusted'` unless the caller says otherwise.
 *
 * A lazy entry: the `@texuli/tokens` root never imports it.
 */

import type { DesignSystem } from '@texuli/spec/design-system';
import { SEMANTIC_ROLES } from '../contract/semantic.ts';
import { validateTheme } from '../contract/validate.ts';
import { type DominantColor, dominantColors, seedsFromColors } from '../generator/image.ts';
import { fromThemeWithReport } from './from-theme.ts';
import {
  at,
  DESIGN_SYSTEM_IMPORT_LIMITS,
  type DesignSystemImportOptions,
  type DesignSystemImportResult,
  documentRoot,
  failInput,
  finalize,
  guard,
  INVISIBLE,
  identity,
  isObject,
  type Json,
  type JsonObject,
  ordered,
  readJson,
  STACK_NAME,
  setPath,
  toColor,
  toNumber,
  toPx,
  toStack,
  Warnings,
} from './io.ts';

export {
  DESIGN_SYSTEM_IMPORT_ERRORS,
  DESIGN_SYSTEM_IMPORT_LIMITS,
  DESIGN_SYSTEM_IMPORT_WARNINGS,
  type DesignSystemImportError,
  type DesignSystemImportOptions,
  type DesignSystemImportResult,
  type DesignSystemImportWarning,
  type DesignSystemImportWarningCode,
} from './io.ts';
export { DESIGN_SYSTEM_EXTENSION, importDtcg, importTokensStudio } from './token-formats.ts';

const NEUTRALS = ['zinc', 'slate', 'stone', 'gray', 'warm', 'cool', 'tinted'];
const ELEVATIONS = ['flat', 'soft', 'crisp', 'glow', 'layered'];
const SURFACES = ['solid', 'glass'];
const FOCUS = ['ring', 'outline', 'glow', 'inset'];
const MOTION = ['none', 'subtle', 'standard', 'expressive'];

/** One-liner words with no argument → the document field they set. */
const WORDS: Readonly<Record<string, readonly [string, Json]>> = {
  sharp: ['shape.radius', 0],
  square: ['shape.radius', 0],
  'slightly rounded': ['shape.radius', 4],
  rounded: ['shape.radius', 12],
  round: ['shape.radius', 12],
  'very rounded': ['shape.radius', 20],
  pill: ['shape.radius', 20],
  dense: ['space.density', 0.75],
  compact: ['space.density', 0.875],
  comfortable: ['space.density', 1],
  cozy: ['space.density', 1],
  spacious: ['space.density', 1.125],
  airy: ['space.density', 1.125],
  flat: ['elevation.style', 'flat'],
  soft: ['elevation.style', 'soft'],
  'soft shadows': ['elevation.style', 'soft'],
  crisp: ['elevation.style', 'crisp'],
  'crisp shadows': ['elevation.style', 'crisp'],
  glow: ['elevation.style', 'glow'],
  layered: ['elevation.style', 'layered'],
  'layered shadows': ['elevation.style', 'layered'],
  glass: ['surface.style', 'glass'],
  glassy: ['surface.style', 'glass'],
  frosted: ['surface.style', 'glass'],
  solid: ['surface.style', 'solid'],
  'no motion': ['motion.personality', 'none'],
  still: ['motion.personality', 'none'],
  calm: ['motion.personality', 'subtle'],
  playful: ['motion.personality', 'expressive'],
  lively: ['motion.personality', 'expressive'],
  expressive: ['motion.personality', 'expressive'],
  aaa: ['accessibility.contrast', 'AAA'],
  'high contrast': ['accessibility.contrast', 'AAA'],
  aa: ['accessibility.contrast', 'AA'],
};

const MOTION_WORDS: Readonly<Record<string, string>> = {
  no: 'none',
  none: 'none',
  calm: 'subtle',
  subtle: 'subtle',
  standard: 'standard',
  expressive: 'expressive',
  playful: 'expressive',
};

/** A font name from one-liner text: quotes stripped, then the document's name rule. */
const fontName = (text: string): string | undefined => {
  const name = text
    .trim()
    .replace(/^(["'])(.*)\1$/, '$2')
    .trim();
  return STACK_NAME.test(name) && !INVISIBLE.test(name) ? name : undefined;
};

const STACKS: Readonly<Record<string, readonly string[]>> = {
  sans: ['system-ui', 'sans-serif'],
  heading: ['system-ui', 'sans-serif'],
  mono: ['ui-monospace', 'monospace'],
  serif: ['serif'],
};

/**
 * A brand one-liner, clauses split by commas, semicolons or new lines:
 * `brand #4f46e5, font Inter, rounded, compact`. Reads `brand|seed|primary
 * <color>`, `secondary <color>`, `accent <color>`, bare colors (seed, then
 * secondary, then accent), `neutral <family>`, `font|sans <name>`,
 * `heading [font] <name>`, `mono [font] <name>`, `serif <name>`,
 * `name <text>`, `id <id>`, `radius <px|rem>`, the shape words (`sharp`,
 * `rounded`, `pill`), density (`dense`, `compact`, `comfortable`,
 * `spacious`), elevation (`flat`, `soft`, `crisp`, `glow`, `layered`),
 * surface (`glass`, `solid`), motion (`calm`, `<word> motion`,
 * `motion <word>`), `focus <ring|outline|glow|inset>` and `AA`/`AAA`.
 * Anything else is an `unmapped` warning.
 */
export function importBrand(
  text: string,
  options: DesignSystemImportOptions = {}
): DesignSystemImportResult {
  const warnings = new Warnings();
  return guard(warnings, () => {
    if (typeof text !== 'string') return failInput(warnings, 'A brand one-liner is text.');
    if (text.length > 1_000)
      return failInput(warnings, 'A brand one-liner is at most 1,000 characters.', 'input-limit');
    const clauses = text
      .split(/[,;\n]/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (clauses.length > 32)
      return failInput(warnings, 'A brand one-liner has at most 32 clauses.', 'input-limit');
    const sections: JsonObject = {};
    const set = (path: string, value: Json) => setPath(sections, path.split('.'), value);
    let name: string | undefined;
    let id: string | undefined;
    const bare: string[] = [];
    clauses.forEach((clause, i) => {
      const where = `$[${i}]`;
      const lower = clause.toLowerCase().replace(/\s+/g, ' ');
      const color = (value: string, path: string) => {
        const converted = toColor(value);
        if (converted.ok) set(path, converted.value);
        else
          warnings.add(
            converted.unsafe ? 'unsafe-value' : 'invalid-value',
            where,
            converted.message
          );
      };
      const font = (value: string, family: string) => {
        const named = fontName(value);
        if (named) set(`typography.families.${family}.stack`, [named, ...(STACKS[family] ?? [])]);
        else warnings.add('unsafe-value', where, 'Refused: not a font family name.');
      };
      /** Clause patterns, first match wins; a handler returning `false` passes the clause on. */
      const rules: [RegExp, string, (m: RegExpExecArray) => boolean | undefined][] = [
        [
          /^(?:brand|seed|primary|colou?r)(?: colou?r)? (.+)$/i,
          clause,
          (m) => {
            color(m[1] as string, 'color.brand.seed');
            return true;
          },
        ],
        [
          /^(secondary|accent)(?: colou?r)? (.+)$/i,
          clause,
          (m) => {
            color(m[2] as string, `color.brand.${(m[1] as string).toLowerCase()}`);
            return true;
          },
        ],
        [
          /^neutral (\S+)$/,
          lower,
          (m) => {
            if (NEUTRALS.includes(m[1] as string)) set('color.brand.neutral', m[1] as string);
            else warnings.add('invalid-value', where, `Neutral is one of ${NEUTRALS.join(', ')}.`);
            return true;
          },
        ],
        [
          /^(?:heading|display)(?: font)? (.+)$/i,
          clause,
          (m) => {
            font(m[1] as string, 'heading');
            return true;
          },
        ],
        [
          /^(?:mono|code)(?: font)? (.+)$/i,
          clause,
          (m) => {
            font(m[1] as string, 'mono');
            return true;
          },
        ],
        [
          /^serif(?: font)? (.+)$/i,
          clause,
          (m) => {
            font(m[1] as string, 'serif');
            return true;
          },
        ],
        [
          /^(?:font|sans|typeface|body font) (.+)$/i,
          clause,
          (m) => {
            font(m[1] as string, 'sans');
            return true;
          },
        ],
        [
          /^(?:name|called) (.+)$/i,
          clause,
          (m) => {
            name = m[1];
            return true;
          },
        ],
        [
          /^id (.+)$/i,
          clause,
          (m) => {
            id = m[1];
            return true;
          },
        ],
        [
          /^radius (.+)$/i,
          clause,
          (m) => {
            const px = toPx(m[1] as string);
            if (px.ok) set('shape.radius', px.value);
            else warnings.add(px.unsafe ? 'unsafe-value' : 'invalid-value', where, px.message);
            return true;
          },
        ],
        [
          /^focus (\S+)$/,
          lower,
          (m) => {
            if (!FOCUS.includes(m[1] as string)) return false;
            set('accessibility.focus', m[1] as string);
            return true;
          },
        ],
        [
          /^(?:(\S+) motion|motion (\S+))$/,
          lower,
          (m) => {
            const personality = MOTION_WORDS[(m[1] ?? m[2]) as string];
            if (!personality) return false;
            set('motion.personality', personality);
            return true;
          },
        ],
      ];
      const handled = rules.some(([pattern, subject, handle]) => {
        const m = pattern.exec(subject);
        return m ? handle(m) === true : false;
      });
      if (handled) return;
      if (WORDS[lower]) {
        const [path, value] = WORDS[lower] as readonly [string, Json];
        set(path, value);
      } else if (NEUTRALS.includes(lower)) set('color.brand.neutral', lower);
      else if (toColor(clause).ok && bare.length < 3) {
        bare.push(clause);
        color(clause, `color.brand.${['seed', 'secondary', 'accent'][bare.length - 1]}`);
      } else warnings.add('unmapped', where, 'No design-system field takes this clause.');
    });
    const doc = documentRoot(identity({ id, name }, options, warnings, 'Brand'));
    for (const key of Object.keys(sections)) doc[key] = sections[key] as Json;
    return finalize(ordered(doc), warnings, options);
  });
}

/** One mode's chart colors in a flat palette (the document's data-viz palette). */
export interface RolePaletteCharts {
  categorical?: string[];
  sequential?: string[];
  diverging?: string[];
  grid?: string;
  axis?: string;
}

/**
 * A flat role palette: the shape many products save their themes in
 * (Protoyard's `protoyard-theme/v1` included). Roles are Texuli's semantic
 * roles in camelCase or kebab-case (`--tx-` optional; `card` and `popover`
 * read as `surface` and `elevated`).
 */
export interface RolePalette {
  /** The host's own format tag; read and kept by the host, ignored here. */
  format?: string;
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  /** The brand seed; defaults to `light.primary`. */
  seed?: string;
  light: Record<string, string>;
  dark?: Record<string, string>;
  fontFamily?: string;
  fontFamilyHeading?: string;
  fontFamilyMono?: string;
  /** A CSS length (`0.5rem`, `8px`) or px. */
  radius?: string | number;
  /** 0.75–1.25. */
  density?: number;
  style?: {
    surface?: 'solid' | 'glass';
    focusRing?: 'ring' | 'outline' | 'glow' | 'inset';
    elevation?: 'flat' | 'soft' | 'crisp' | 'glow' | 'layered';
    motion?: 'none' | 'subtle' | 'standard' | 'expressive';
  };
  charts?: { light?: RolePaletteCharts; dark?: RolePaletteCharts };
}

const ROLES = new Set<string>(SEMANTIC_ROLES);
const PALETTE_ALIASES: Readonly<Record<string, string>> = {
  card: 'surface',
  cardForeground: 'surfaceForeground',
  popover: 'elevated',
  popoverForeground: 'elevatedForeground',
};
const PALETTE_KEYS = new Set([
  'format',
  'id',
  'name',
  'description',
  'version',
  'seed',
  'light',
  'dark',
  'fontFamily',
  'fontFamilyHeading',
  'fontFamilyMono',
  'radius',
  'density',
  'style',
  'charts',
]);

/** A palette role name as a semantic role, or `undefined`. */
export function paletteRole(key: string): string | undefined {
  const name = key
    .replace(/^--tx-/, '')
    .replace(/[-_]+([a-z0-9])/gi, (_, c: string) => c.toUpperCase());
  const role = PALETTE_ALIASES[name] ?? name;
  return ROLES.has(role) ? role : undefined;
}

/** A flat role palette (object or JSON text) as a design-system document. */
export function importRolePalette(
  input: unknown,
  options: DesignSystemImportOptions = {}
): DesignSystemImportResult {
  const warnings = new Warnings();
  return guard(warnings, () => {
    const root = readJson(input, warnings, options.maxBytes ?? DESIGN_SYSTEM_IMPORT_LIMITS.bytes);
    if (!isObject(root) || !isObject(root.light))
      return failInput(warnings, 'A role palette is an object with a `light` role map.');
    for (const key of Object.keys(root))
      if (!PALETTE_KEYS.has(key))
        warnings.add('unmapped', at('$', key), 'No design-system field takes this key.');
    const doc = documentRoot(identity(root, options, warnings, 'Imported palette'));
    const set = (path: string, value: Json) => setPath(doc, path.split('.'), value);
    const refuse = (where: string, result: { unsafe: boolean; message: string }) =>
      warnings.add(result.unsafe ? 'unsafe-value' : 'invalid-value', where, result.message);
    if (root.seed !== undefined) {
      const seed = toColor(root.seed);
      if (seed.ok) set('color.brand.seed', seed.value);
      else refuse('$.seed', seed);
    }
    for (const mode of ['light', 'dark'] as const) {
      const map = root[mode];
      if (map === undefined) continue;
      if (!isObject(map)) {
        warnings.add('invalid-value', at('$', mode), 'Expected a role map.');
        continue;
      }
      for (const key of Object.keys(map)) {
        const where = at(at('$', mode), key);
        const role = paletteRole(key);
        if (!role) {
          warnings.add('unmapped', where, 'Not a Texuli semantic role.');
          continue;
        }
        const color = toColor(map[key]);
        if (color.ok) set(`color.roles.${mode}.${role}`, color.value);
        else refuse(where, color);
      }
    }
    for (const [key, family] of [
      ['fontFamily', 'sans'],
      ['fontFamilyHeading', 'heading'],
      ['fontFamilyMono', 'mono'],
    ] as const) {
      if (root[key] === undefined) continue;
      const stack = toStack(root[key]);
      if (!stack.ok) refuse(at('$', key), stack);
      else {
        if (stack.dropped)
          warnings.add('unsafe-value', at('$', key), 'Refused names were dropped.');
        set(`typography.families.${family}.stack`, stack.value);
      }
    }
    if (root.radius !== undefined) {
      const radius = toPx(root.radius);
      if (radius.ok) set('shape.radius', radius.value);
      else refuse('$.radius', radius);
    }
    if (root.density !== undefined) {
      const density = toNumber(root.density);
      if (density.ok) set('space.density', density.value);
      else refuse('$.density', density);
    }
    if (root.style !== undefined) {
      const style = isObject(root.style) ? root.style : {};
      const knobs: [string, readonly string[], string][] = [
        ['surface', SURFACES, 'surface.style'],
        ['focusRing', FOCUS, 'accessibility.focus'],
        ['elevation', ELEVATIONS, 'elevation.style'],
        ['motion', MOTION, 'motion.personality'],
      ];
      for (const key of Object.keys(style))
        if (!knobs.some(([name]) => name === key))
          warnings.add('unmapped', at('$.style', key), 'No design-system field takes this key.');
      for (const [key, allowed, path] of knobs) {
        const value = style[key];
        if (value === undefined) continue;
        if (typeof value === 'string' && allowed.includes(value)) set(path, value);
        else warnings.add('invalid-value', at('$.style', key), `One of ${allowed.join(', ')}.`);
      }
    }
    if (root.charts !== undefined) {
      const charts = isObject(root.charts) ? root.charts : {};
      for (const mode of ['light', 'dark'] as const) {
        const palette = charts[mode];
        if (!isObject(palette)) continue;
        for (const key of ['categorical', 'sequential', 'diverging', 'grid', 'axis']) {
          const value = palette[key];
          if (value === undefined) continue;
          const where = at(at('$.charts', mode), key);
          if (Array.isArray(value)) {
            const colors = value.map((item) => toColor(item));
            const failed = colors.find((c) => !c.ok);
            if (failed && !failed.ok) refuse(where, failed);
            else
              set(
                `color.dataViz.${mode}.${key}`,
                colors.map((c) => (c.ok ? c.value : ''))
              );
          } else {
            const color = toColor(value);
            if (color.ok) set(`color.dataViz.${mode}.${key}`, color.value);
            else refuse(where, color);
          }
        }
      }
    }
    return finalize(ordered(doc), warnings, options);
  });
}

/** Options of {@link importTheme}. */
export interface ImportThemeOptions extends DesignSystemImportOptions {
  /**
   * The theme-to-document bridge. Defaults to the one without the compiler;
   * pass `fromThemeWithReport` from `@texuli/tokens/design-system/compile`
   * (or `compile-core`) so the document always compiles, its dropped pins
   * listed as `lossy` warnings (G135).
   */
  fromTheme?: typeof fromThemeWithReport;
}

/**
 * A Texuli `Theme` (object or JSON text) as a document, through
 * `fromThemeWithReport`: the fields the closed vocabulary cannot carry are
 * `lossy` warnings. An invalid theme is `invalid-input` with its issues.
 */
export function importTheme(
  input: unknown,
  options: ImportThemeOptions = {}
): DesignSystemImportResult {
  const warnings = new Warnings();
  return guard(warnings, () => {
    const root = readJson(input, warnings, options.maxBytes ?? DESIGN_SYSTEM_IMPORT_LIMITS.bytes);
    const theme = validateTheme(root);
    if (!theme.ok)
      return {
        ok: false,
        errors: theme.issues.slice(0, 64).map((issue) => ({
          code: 'invalid-input' as const,
          path: issue.path ? `$.${issue.path}` : '$',
          message: issue.message,
        })),
        warnings: warnings.list,
      };
    const { document, losses } = (options.fromTheme ?? fromThemeWithReport)(theme.value, {
      ...(options.id ? { id: options.id } : {}),
      ...(options.version ? { version: options.version } : {}),
    });
    for (const loss of losses) warnings.add('lossy', loss.path, loss.reason);
    const doc = document as unknown as JsonObject;
    if (options.name) {
      const id = identity({ name: options.name }, {}, warnings, doc.name as string);
      doc.name = id.name;
    }
    return finalize(doc, warnings, options);
  });
}

/** Pixels as `ImageData` holds them: RGBA, 4 values a pixel. */
export interface LogoPixels {
  data: ArrayLike<number>;
}

export type LogoPaletteResult = DesignSystemImportResult & {
  /** The dominant colors, most common first (only on success). */
  palette: DominantColor[];
};

/** At most 4096 × 4096 RGBA pixels. */
const MAX_PIXEL_VALUES = 4096 * 4096 * 4;
const SAMPLES = 20_000;

/**
 * A suggested palette from a logo's pixels (`ImageData`, or `{ data }` with
 * a typed array or a list of numbers): `dominantColors` over an even sample
 * of at most 20,000 pixels, then `seedsFromColors` for the brand seed and
 * secondary. Deterministic: the same pixels give the same document, whatever
 * array type holds them.
 */
export function importLogoPixels(
  pixels: LogoPixels,
  options: DesignSystemImportOptions & { count?: number } = {}
): LogoPaletteResult {
  const warnings = new Warnings();
  let palette: DominantColor[] = [];
  const result = guard(warnings, () => {
    const data = isObject(pixels as never) ? (pixels as { data?: unknown }).data : undefined;
    const typed =
      data instanceof Uint8Array || data instanceof Uint8ClampedArray || Array.isArray(data);
    const length =
      typeof data === 'object' && data !== null ? (data as { length?: unknown }).length : undefined;
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 0)
      return failInput(warnings, 'Pixels are `{ data }` with RGBA values.');
    if (length > MAX_PIXEL_VALUES)
      return failInput(warnings, 'At most 4096 × 4096 pixels.', 'input-limit');
    if (!typed)
      return failInput(warnings, 'Pixel data is a Uint8Array, Uint8ClampedArray or list.');
    const source = data as ArrayLike<unknown>;
    const total = Math.floor(length / 4);
    const stride = Math.max(1, Math.ceil(total / SAMPLES));
    const sample = new Uint8ClampedArray(Math.ceil(total / stride) * 4);
    let n = 0;
    for (let p = 0; p < total; p += stride) {
      for (let c = 0; c < 4; c++) {
        const v = source[p * 4 + c];
        sample[n++] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
      }
    }
    const count = Math.min(12, Math.max(2, Math.floor(options.count ?? 6)));
    palette = dominantColors({ data: sample.subarray(0, n) }, { count });
    if (palette.length === 0) return failInput(warnings, 'The image has no opaque pixels.');
    const seeds = seedsFromColors(palette);
    const doc = documentRoot(identity({}, options, warnings, 'Logo palette'));
    doc.color = { brand: { ...seeds } };
    return finalize(doc, warnings, options);
  });
  return { ...result, palette: result.ok ? palette : [] } as LogoPaletteResult;
}

export type { DesignSystem };
