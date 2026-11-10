/**
 * `@texuli/tokens/design-system/import` (T-ds-io): turn what a company
 * already has into a valid design-system document, warnings and a uniform
 * loss report. Each importer is pure, synchronous and deterministic, and never throws: input
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
import { type DesignSystemImportResultWithLosses, withLossReport } from './token-formats.ts';

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
export {
  DESIGN_SYSTEM_EXTENSION,
  type DesignSystemImportLoss,
  type DesignSystemImportResultWithLosses,
  importDtcg,
  importTokensStudio,
} from './token-formats.ts';

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

const CSS_COLOR_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  `aliceblue=f0f8ff antiquewhite=faebd7 aqua=00ffff aquamarine=7fffd4 azure=f0ffff beige=f5f5dc bisque=ffe4c4 black=000000 blanchedalmond=ffebcd blue=0000ff blueviolet=8a2be2 brown=a52a2a burlywood=deb887 cadetblue=5f9ea0 chartreuse=7fff00 chocolate=d2691e coral=ff7f50 cornflowerblue=6495ed cornsilk=fff8dc crimson=dc143c cyan=00ffff darkblue=00008b darkcyan=008b8b darkgoldenrod=b8860b darkgray=a9a9a9 darkgreen=006400 darkgrey=a9a9a9 darkkhaki=bdb76b darkmagenta=8b008b darkolivegreen=556b2f darkorange=ff8c00 darkorchid=9932cc darkred=8b0000 darksalmon=e9967a darkseagreen=8fbc8f darkslateblue=483d8b darkslategray=2f4f4f darkslategrey=2f4f4f darkturquoise=00ced1 darkviolet=9400d3 deeppink=ff1493 deepskyblue=00bfff dimgray=696969 dimgrey=696969 dodgerblue=1e90ff firebrick=b22222 floralwhite=fffaf0 forestgreen=228b22 fuchsia=ff00ff gainsboro=dcdcdc ghostwhite=f8f8ff gold=ffd700 goldenrod=daa520 gray=808080 green=008000 greenyellow=adff2f grey=808080 honeydew=f0fff0 hotpink=ff69b4 indianred=cd5c5c indigo=4b0082 ivory=fffff0 khaki=f0e68c lavender=e6e6fa lavenderblush=fff0f5 lawngreen=7cfc00 lemonchiffon=fffacd lightblue=add8e6 lightcoral=f08080 lightcyan=e0ffff lightgoldenrodyellow=fafad2 lightgray=d3d3d3 lightgreen=90ee90 lightgrey=d3d3d3 lightpink=ffb6c1 lightsalmon=ffa07a lightseagreen=20b2aa lightskyblue=87cefa lightslategray=778899 lightslategrey=778899 lightsteelblue=b0c4de lightyellow=ffffe0 lime=00ff00 limegreen=32cd32 linen=faf0e6 magenta=ff00ff maroon=800000 mediumaquamarine=66cdaa mediumblue=0000cd mediumorchid=ba55d3 mediumpurple=9370db mediumseagreen=3cb371 mediumslateblue=7b68ee mediumspringgreen=00fa9a mediumturquoise=48d1cc mediumvioletred=c71585 midnightblue=191970 mintcream=f5fffa mistyrose=ffe4e1 moccasin=ffe4b5 navajowhite=ffdead navy=000080 oldlace=fdf5e6 olive=808000 olivedrab=6b8e23 orange=ffa500 orangered=ff4500 orchid=da70d6 palegoldenrod=eee8aa palegreen=98fb98 paleturquoise=afeeee palevioletred=db7093 papayawhip=ffefd5 peachpuff=ffdab9 peru=cd853f pink=ffc0cb plum=dda0dd powderblue=b0e0e6 purple=800080 rebeccapurple=663399 red=ff0000 rosybrown=bc8f8f royalblue=4169e1 saddlebrown=8b4513 salmon=fa8072 sandybrown=f4a460 seagreen=2e8b57 seashell=fff5ee sienna=a0522d silver=c0c0c0 skyblue=87ceeb slateblue=6a5acd slategray=708090 slategrey=708090 snow=fffafa springgreen=00ff7f steelblue=4682b4 tan=d2b48c teal=008080 thistle=d8bfd8 tomato=ff6347 turquoise=40e0d0 violet=ee82ee wheat=f5deb3 white=ffffff whitesmoke=f5f5f5 yellow=ffff00 yellowgreen=9acd32`
    .split(/\s+/)
    .map((entry) => entry.split('=') as [string, string])
    .map(([name, value]) => [name, `#${value}`])
);

const COLOR_WORD_PATTERN = Object.keys(CSS_COLOR_NAMES)
  .sort((a, b) => b.length - a.length)
  .join('|');
const PROSE_COLOR_PATTERN = new RegExp(
  `(?<![\\w])#(?:[\\da-f]{8}|[\\da-f]{6}|[\\da-f]{4}|[\\da-f]{3})(?![\\w])|\\b(?:${COLOR_WORD_PATTERN})\\b`,
  'gi'
);

function blankRange(text: string, start: number, end: number): string {
  return `${text.slice(0, start)}${' '.repeat(end - start)}${text.slice(end)}`;
}

function proseColor(text: string): string | undefined {
  const hex = /(?<![\w])#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?![\w])/gi.exec(text)?.[0];
  if (hex) {
    const converted = toColor(hex);
    if (converted.ok) return converted.value;
  }
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    const color = CSS_COLOR_NAMES[word];
    if (color) return color;
  }
}

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
): DesignSystemImportResultWithLosses {
  const warnings = new Warnings();
  const result = guard(warnings, () => {
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
      if (/(?:url\s*\(|expression\s*\(|[{}<>])/i.test(clause)) {
        warnings.add('unsafe-value', where, 'Refused CSS or markup syntax in a brand brief.');
        return;
      }
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
      // Read explicit color mentions throughout a clause so role words can
      // precede or follow a value, and multiple assignments are not dropped.
      // Any remaining prose is reported instead of being silently ignored.
      const colorMatches = [...clause.matchAll(PROSE_COLOR_PATTERN)];
      if (colorMatches.length > 0) {
        if (/^color\s*:/i.test(clause)) {
          warnings.add(
            'invalid-value',
            where,
            'Use prose color assignments, not CSS declarations.'
          );
          return;
        }
        let remainder = clause;
        let previousEnd = 0;
        let assigned = 0;
        const firstHex = colorMatches.find((match) => (match[0] as string).startsWith('#'))?.index;
        for (const match of colorMatches) {
          const raw = match[0] as string;
          const start = match.index ?? 0;
          const end = start + raw.length;
          const between = clause.slice(previousEnd, start);
          const roleMatch =
            /\b(brand|seed|primary|secondary|accent)\b(?!.*\b(?:brand|seed|primary|secondary|accent)\b)/i.exec(
              between
            );
          const role = roleMatch?.[1]?.toLowerCase();
          if (!raw.startsWith('#') && firstHex !== undefined && start < firstHex && !role) {
            // Descriptive color words before an explicit hex seed (for
            // example, “Deep teal #0f766e”) are prose, not a second value.
            remainder = blankRange(remainder, start, end);
            previousEnd = end;
            continue;
          }
          const target =
            role === 'secondary' || role === 'accent'
              ? role
              : role === 'brand' || role === 'seed' || role === 'primary'
                ? 'seed'
                : (['seed', 'secondary', 'accent'][Math.min(assigned, 2)] as string);
          const converted = raw.startsWith('#')
            ? toColor(raw)
            : { ok: true as const, value: CSS_COLOR_NAMES[raw.toLowerCase()] as string };
          if (converted.ok) {
            set(`color.brand.${target}`, converted.value);
            assigned += 1;
            remainder = blankRange(remainder, start, end);
            if (roleMatch?.index !== undefined) {
              const roleStart = previousEnd + roleMatch.index;
              remainder = blankRange(remainder, roleStart, roleStart + roleMatch[0].length);
            }
          } else {
            warnings.add(
              converted.unsafe ? 'unsafe-value' : 'invalid-value',
              where,
              converted.message
            );
          }
          previousEnd = end;
        }

        const afterFont = /\b(?:font|sans|typeface|body\s+font)\s+(.+)$/i.exec(remainder);
        const beforeFont = /\b([A-Za-z][A-Za-z0-9 _-]{0,32}?)\s+font\b/i.exec(remainder);
        const fontMatch =
          !beforeFont || (afterFont && (afterFont.index ?? 0) < (beforeFont.index ?? 0))
            ? afterFont
            : beforeFont;
        if (fontMatch) {
          const familyName = (fontMatch[1] as string)
            .split(/\b(?:in|and|with|using|on)\b/i, 1)[0]
            ?.trim();
          if (familyName) font(familyName, 'sans');
          const start = fontMatch.index ?? 0;
          remainder = blankRange(remainder, start, start + fontMatch[0].length);
        }

        const unread = remainder
          .replace(/\b(?:and|is|uses?|using|the|brand|color|colour|in|with|on|a|an)\b/gi, ' ')
          .replace(/[\s:=,.;-]+/g, ' ')
          .trim();
        if (unread) {
          const suspicious = /(?:url\s*\(|expression\s*\(|[{};<>])/i.test(unread);
          warnings.add(
            suspicious ? 'unsafe-value' : 'unmapped',
            where,
            `Unrecognized brand brief text: ${unread}`
          );
        }
        return;
      }
      const proseFont =
        /\b((?!(?:heading|display|mono|code|serif)\b)[A-Za-z][A-Za-z0-9 _-]{0,32}?)\s+font\b/i.exec(
          clause
        );
      if (proseFont) {
        const familyName = (proseFont[1] as string).trim();
        font(familyName, 'sans');
        const remainder = blankRange(
          clause,
          proseFont.index ?? 0,
          (proseFont.index ?? 0) + proseFont[0].length
        )
          .replace(/\b(?:and|is|uses?|using|the|in|with|on|a|an)\b/gi, ' ')
          .replace(/[\s:=,.;-]+/g, ' ')
          .trim();
        if (remainder)
          warnings.add('unmapped', where, `Unrecognized brand brief text: ${remainder}`);
        return;
      }
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
      const mentionedColor = proseColor(clause);
      if (mentionedColor) {
        const target = /\bsecondary\b/i.test(clause)
          ? 'color.brand.secondary'
          : /\baccent\b/i.test(clause)
            ? 'color.brand.accent'
            : `color.brand.${['seed', 'secondary', 'accent'][Math.min(bare.length, 2)]}`;
        if (!/\b(?:secondary|accent|brand|seed|primary|colou?r)\b/i.test(clause)) bare.push(clause);
        set(target, mentionedColor);
        return;
      }
      if (WORDS[lower]) {
        const [path, value] = WORDS[lower] as readonly [string, Json];
        set(path, value);
      } else if (NEUTRALS.includes(lower)) set('color.brand.neutral', lower);
      else if (toColor(clause).ok && bare.length < 3) {
        bare.push(clause);
        color(clause, `color.brand.${['seed', 'secondary', 'accent'][bare.length - 1]}`);
      } else warnings.add('unmapped', where, `No design-system field takes this clause: ${clause}`);
    });
    const doc = documentRoot(identity({ id, name }, options, warnings, 'Brand'));
    for (const key of Object.keys(sections)) doc[key] = sections[key] as Json;
    return finalize(ordered(doc), warnings, options);
  });
  return withLossReport(result);
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
): DesignSystemImportResultWithLosses {
  const warnings = new Warnings();
  const result = guard(warnings, () => {
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
  return withLossReport(result);
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
): DesignSystemImportResultWithLosses {
  const warnings = new Warnings();
  const result = guard(warnings, () => {
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
  return withLossReport(result);
}

/** Pixels as `ImageData` holds them: RGBA, 4 values a pixel. */
export interface LogoPixels {
  data: ArrayLike<number>;
}

export type LogoPaletteResult = DesignSystemImportResultWithLosses & {
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
  return { ...withLossReport(result), palette: result.ok ? palette : [] } as LogoPaletteResult;
}

/** The site-CSS and fonts importer (T-gen-css); exported beside the other importers, never from the package root. */
export { importSiteCss } from './import-css.ts';
export type { DesignSystem };
