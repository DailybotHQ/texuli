import { pascal } from '../codegen/shared.ts';
import type { Schema } from '../dialect.ts';
import { DIALECT_URI } from '../dialect.ts';
import {
  DESIGN_SYSTEM_CODES,
  DESIGN_SYSTEM_COMPILER_CODES,
  DESIGN_SYSTEM_LIMITS,
  DS_DEFS,
  DS_PATTERNS,
  DS_ROOT,
  type DsNode,
  type DsObject,
} from './vocabulary.ts';

/**
 * Build-time projection of the design-system vocabulary table into a
 * dialect schema (`schemas/design-system.schema.json`), from which the spec
 * generator writes the TypeScript and Kotlin types. Every object becomes a
 * named `$defs` entry (named definitions keep their name; anonymous ones are
 * named after their path), so both generators can project it. Rules the
 * dialect cannot express (map key patterns, unique items, trust-dependent
 * data URLs, inline byte caps, the `extends` chain) are described here and
 * enforced by `validateDesignSystem`.
 */

const DESCRIPTIONS: Readonly<Record<string, string>> = {
  colorValue: 'A color: #rgb, #rrggbb, #rrggbbaa or a numeric oklch(L C H[ / A]).',
  roleName: 'A semantic color role of the token contract.',
  roleMap: 'Explicit role pins for one mode: checked by the compiler, never moved (ADR-022).',
  dataVizPalette: 'One mode’s chart palette: 8 categorical, 9 sequential and 9 diverging colors.',
  fontFile: `A self-hosted font file: a same-origin relative path (.woff2, .woff, .ttf, .otf), or at developer trust a base64 data:font URL of at most ${DESIGN_SYSTEM_LIMITS.font} bytes.`,
  fontFamily: 'A family stack (1 to 8 names, quoted by the compiler) and its font files.',
  typeRole: 'A type role: family, size (px), weight, line height and tracking (em).',
  typeRoleName: 'A type role name.',
  radiusStep: 'A shape radius step.',
  spaceStep: 'A space step.',
  dimension: 'A space, control, icon or target size step.',
  borderStep: 'A border width step.',
  elevationLevel: 'An elevation level.',
  opacityStep: 'An opacity step.',
  strokeWidth: 'A stroke width in px.',
  asset: `An image: a same-origin relative path (png, jpg, gif, webp, avif, svg, ico; never .., \\, %, ?, # or //), or at developer trust a base64 data:image (png, jpeg, gif, webp, avif) of at most ${DESIGN_SYSTEM_LIMITS.logo} bytes. SVG renders only as <img>.`,
  color:
    'Color: brand seeds, exact pins, explicit role pins per mode, modes, data viz per mode and status colors.',
  typography: 'Typography: family stacks with font files, the scale and the type roles.',
  shape: 'Shape: radius (px), radius scale and border width (px).',
  space: 'Space: the base unit (px) and the density multiplier.',
  elevation: 'Elevation style.',
  surface: 'Surface style and glass settings.',
  motion: 'Motion personality, durations (ms) and a named easing.',
  layout: 'Layout widths, breakpoints and the grid (px).',
  icons: 'Icon style, stroke and sizes (px).',
  components: `Component tokens (the token registry, z-index left out) and defaults (variant and size), per component.`,
  assets: 'Brand assets: logos and the favicon.',
  voice: 'Voice data: tone words, a lexicon (at most 200 entries) and guidelines.',
  accessibility: 'Accessibility targets: contrast, minimum target size and the focus style.',
  variant:
    'A named variant (high-contrast, compact, seasonal): a closed partial document of sections, orthogonal to mode.',
  issueCode:
    'Every stable design-system code; aa-text, aa-focus and target-size are raised by the compiler.',
  issue:
    'One design-system issue: a stable code, a JSON path from $, a message and an optional hint.',
};

function source(node: readonly ['u', 'i' | 'f', number]): Schema {
  const path = (node[1] === 'i' ? DS_PATTERNS.image : DS_PATTERNS.font).source.slice(1, -1);
  const data =
    node[1] === 'i' ? 'data:image\\/(?:png|jpeg|gif|webp|avif)' : 'data:font\\/(?:woff2?|ttf|otf)';
  return {
    description: `At most ${node[2]} bytes inline; data URLs need developer trust.`,
    type: 'string',
    pattern: `^(?:${path}|${data};base64,[A-Za-z0-9+/]+={0,2})$`,
  };
}

/** The design-system document schema, projected from the vocabulary table. */
export function designSystemSchema(): Schema {
  const defs: Record<string, Schema> = {};
  const toSchema = (node: DsNode, name: string): Schema => {
    if (typeof node === 'string') return { $ref: `#/$defs/${node}` };
    if (!Array.isArray(node)) {
      if (!Object.hasOwn(defs, name)) defs[name] = objectSchema(node as DsObject, name);
      return { $ref: `#/$defs/${name}` };
    }
    const n = node as Exclude<DsNode, string | DsObject>;
    switch (n[0]) {
      case 'e':
        return { type: 'string', enum: n[1].split(' ') };
      case 'n':
      case 'i':
        return { type: n[0] === 'i' ? 'integer' : 'number', minimum: n[1], maximum: n[2] };
      case 's':
        return { type: 'string', maxLength: n[2], pattern: n[1].source };
      case 't':
        return { type: 'string', maxLength: n[1], pattern: DS_PATTERNS.text.source };
      case 'l':
        return {
          ...(n[4] ? { description: 'Unique items.' } : {}),
          type: 'array',
          items: toSchema(n[1], `${name}Item`),
          ...(n[2] > 0 ? { minItems: n[2] } : {}),
          maxItems: n[3],
        };
      case 'm':
        return {
          description: `At most ${n[2]} entries; keys match ${n[3].source} and are never __proto__, constructor or prototype.`,
          type: 'object',
          additionalProperties: toSchema(n[1], `${name}Value`),
        };
      case 'b':
        return { type: 'boolean' };
      case 'k':
        return { const: n[1] };
      case 'u':
        return source(n);
      case 'x':
        return {
          description:
            'texuli:<theme> or an exact id@x.y.z; never a range, a URL or a path. Cycles and chains deeper than 4 are refused.',
          type: 'string',
          pattern: DS_PATTERNS.ref.source,
        };
    }
  };
  function objectSchema(shape: DsObject, name: string): Schema {
    const properties: Record<string, Schema> = {};
    const required: string[] = [];
    for (const [raw, child] of Object.entries(shape)) {
      const key = raw.replace(/!$/, '');
      if (raw.endsWith('!')) required.push(key);
      properties[key] = toSchema(child, `${name}${pascal(key)}`);
    }
    return {
      ...(DESCRIPTIONS[name] ? { description: DESCRIPTIONS[name] } : {}),
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
      additionalProperties: false,
    };
  }
  for (const [name, node] of Object.entries(DS_DEFS)) {
    if (typeof node !== 'string' && !Array.isArray(node)) toSchema(node, name);
    else {
      const schema = toSchema(node, name);
      defs[name] = DESCRIPTIONS[name] ? { description: DESCRIPTIONS[name], ...schema } : schema;
    }
  }
  defs.issueCode = {
    description: DESCRIPTIONS.issueCode,
    type: 'string',
    enum: [...DESIGN_SYSTEM_CODES, ...DESIGN_SYSTEM_COMPILER_CODES],
  };
  defs.issue = {
    description: DESCRIPTIONS.issue,
    type: 'object',
    properties: {
      code: { $ref: '#/$defs/issueCode' },
      path: { type: 'string' },
      message: { type: 'string' },
      hint: { type: 'string' },
    },
    required: ['code', 'path', 'message'],
    additionalProperties: false,
  };
  const root = objectSchema(DS_ROOT, 'designSystem');
  const ordered: Record<string, Schema> = {};
  for (const key of Object.keys(defs).sort()) ordered[key] = defs[key] as Schema;
  return {
    $schema: DIALECT_URI,
    $id: 'https://texuli.example/spec/schemas/design-system.schema.json',
    title: 'DesignSystem',
    description:
      'A Texuli design system (ADR-021, formatVersion 1): one closed JSON document a company or an agent writes once and every Texuli surface follows. Data only: colors are hex or numeric oklch, lengths are numbers in px, fonts and assets are same-origin relative paths or capped data URLs, and nothing reaches CSS that the token contract’s css-safe checks would refuse. Generated from @texuli/spec/design-system’s vocabulary by scripts/design-system-schema.ts; validateDesignSystem enforces the rules the dialect cannot express.',
    type: 'object',
    properties: root.properties,
    required: root.required,
    additionalProperties: false,
    $defs: ordered,
  } as Schema;
}
