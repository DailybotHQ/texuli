/**
 * Pure helpers of the Design System Studio (PLAN_011 T-ds-studio): the
 * starting document, the editor's field table for every section of the
 * design-system document, immutable path edits, plain-language explanations
 * of the spec's codes, the export formats, import detection and the preview
 * mode. No DOM and no engine imports: the island loads the compiler,
 * importers and emitters lazily (`ds-engine.ts`), so this module stays a few
 * KB. The one runtime import is `pickDesignSystemMode`, from the apply entry
 * the preview's `DesignSystemProvider` loads anyway.
 *
 * The field table mirrors the closed vocabulary of `@texuli/spec`
 * (`src/design-system/vocabulary.ts`); `apps/website/tests/ds-studio.test.ts`
 * proves every field's bounds and options against `validateDesignSystem`.
 */

import {
  type ApplicableDesignSystem,
  pickDesignSystemMode,
} from '@texuli/tokens/design-system/apply';

/** A design-system document as the studio holds it: plain JSON. */
export type StudioDocument = Record<string, unknown>;

export const DS_FORMAT = 'texuli/design-system';
export const STUDIO_DOCUMENT_ID = 'studio';
export const DEFAULT_SEED = '#2b6ce0';

/** The document the studio opens with (and the one its static JSON is compiled from). */
export function seedDocument(
  seed: string = DEFAULT_SEED,
  name = 'Studio draft',
  secondary?: string
): StudioDocument {
  return {
    format: DS_FORMAT,
    formatVersion: 1,
    id: STUDIO_DOCUMENT_ID,
    version: '1.0.0',
    name,
    color: { brand: secondary ? { seed, secondary } : { seed } },
  };
}

/** A document that extends one library theme (`texuli:<id>`). */
export function libraryDocument(themeId: string, name: string): StudioDocument {
  return {
    format: DS_FORMAT,
    formatVersion: 1,
    id: STUDIO_DOCUMENT_ID,
    version: '1.0.0',
    name,
    extends: `texuli:${themeId}`,
  };
}

/* ── Paths ─────────────────────────────────────────────────────────────── */

export type Path = readonly string[];

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** The spec's JSON path for a field (`$.components["icon-button"].radius`). */
export function issuePath(path: Path): string {
  let out = '$';
  for (const key of path) out += IDENT.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
  return out;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

/** The value at `path`, or `undefined`. */
export function getAt(doc: unknown, path: Path): unknown {
  let node: unknown = doc;
  for (const key of path) {
    if (!isRecord(node) || !Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

/**
 * A copy of `doc` with `value` at `path`. `undefined` removes the key, and
 * objects left empty by a removal are removed too (never the root), so a
 * cleared field leaves no `{}` behind. Reserved keys are refused.
 */
export function setAt(doc: StudioDocument, path: Path, value: unknown): StudioDocument {
  if (path.length === 0 || path.some((key) => RESERVED.has(key))) return doc;
  const write = (node: Record<string, unknown>, index: number): Record<string, unknown> => {
    const key = path[index] as string;
    const next: Record<string, unknown> = { ...node };
    if (index === path.length - 1) {
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    }
    const child = isRecord(node[key]) ? (node[key] as Record<string, unknown>) : {};
    const written = write(child, index + 1);
    if (Object.keys(written).length === 0) delete next[key];
    else next[key] = written;
    return next;
  };
  return write(doc, 0);
}

/* ── Fields ────────────────────────────────────────────────────────────── */

export type FieldKind =
  | 'color'
  | 'number'
  | 'integer'
  | 'enum'
  | 'text'
  | 'list'
  | 'lines'
  | 'map'
  | 'bool'
  | 'modes';

export interface FieldSpec {
  path: Path;
  label: string;
  kind: FieldKind;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: readonly string[];
  help?: string;
  placeholder?: string;
}

export interface SectionSpec {
  id: string;
  title: string;
  summary: string;
  fields: readonly FieldSpec[];
}

export const NEUTRALS = ['zinc', 'slate', 'stone', 'gray', 'warm', 'cool', 'tinted'] as const;
export const PIN_ROLES = [
  'primary',
  'secondary',
  'accent',
  'destructive',
  'success',
  'warning',
  'info',
] as const;
export const STATUS_KEYS = ['success', 'warning', 'danger', 'info', 'neutral'] as const;
export const TYPE_ROLES = [
  'display',
  'title',
  'heading',
  'body',
  'label',
  'caption',
  'code',
] as const;
export const FAMILIES = ['sans', 'heading', 'mono', 'serif'] as const;
export const SPACE_STEPS = Array.from({ length: 13 }, (_, step) => `space-${step}`);
export const GRID_KEYS = ['base', 'sm', 'md', 'lg'] as const;

/** The 50 semantic roles a role pin may set (`@texuli/tokens` `SEMANTIC_ROLES`). */
export const ROLES = [
  'background',
  'foreground',
  'surface',
  'surfaceForeground',
  'elevated',
  'elevatedForeground',
  'muted',
  'mutedForeground',
  'subtle',
  'subtleForeground',
  'border',
  'borderStrong',
  'input',
  'ring',
  'primary',
  'primaryForeground',
  'primarySoft',
  'primarySoftForeground',
  'secondary',
  'secondaryForeground',
  'accent',
  'accentForeground',
  'destructive',
  'destructiveForeground',
  'destructiveSoft',
  'destructiveSoftForeground',
  'success',
  'successForeground',
  'successSoft',
  'successSoftForeground',
  'warning',
  'warningForeground',
  'warningSoft',
  'warningSoftForeground',
  'info',
  'infoForeground',
  'infoSoft',
  'infoSoftForeground',
  'sidebar',
  'sidebarForeground',
  'sidebarBorder',
  'sidebarPrimary',
  'overlay',
  'scrim',
  'shadow',
  'link',
  'linkVisited',
  'selection',
  'selectionForeground',
  'canvas',
] as const;

/** `primaryForeground` → `primary foreground`, for labels. */
export function words(camel: string): string {
  return camel
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/-/g, ' ')
    .toLowerCase();
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const color = (path: Path, label: string, help?: string): FieldSpec => ({
  path,
  label,
  kind: 'color',
  placeholder: '#rrggbb',
  ...(help ? { help } : {}),
});
const num = (
  path: Path,
  label: string,
  min: number,
  max: number,
  step: number,
  unit?: string,
  help?: string
): FieldSpec => ({
  path,
  label,
  kind: 'number',
  min,
  max,
  step,
  ...(unit ? { unit } : {}),
  ...(help ? { help } : {}),
});
const int = (path: Path, label: string, min: number, max: number, unit?: string): FieldSpec => ({
  path,
  label,
  kind: 'integer',
  min,
  max,
  step: 1,
  ...(unit ? { unit } : {}),
});
const choice = (
  path: Path,
  label: string,
  options: readonly string[],
  help?: string
): FieldSpec => ({
  path,
  label,
  kind: 'enum',
  options,
  ...(help ? { help } : {}),
});

/** The fields of one type role (`typography.roles.<role>`). */
export function typeRoleFields(role: string): FieldSpec[] {
  const base = ['typography', 'roles', role];
  return [
    choice([...base, 'family'], `${capital(role)} family`, FAMILIES),
    num([...base, 'size'], `${capital(role)} size`, 8, 128, 1, 'px'),
    int([...base, 'weight'], `${capital(role)} weight`, 100, 900),
    num([...base, 'line'], `${capital(role)} line height`, 1, 2.5, 0.05),
    num([...base, 'tracking'], `${capital(role)} tracking`, -0.1, 0.2, 0.005, 'em'),
  ];
}

/** The field of one role pin (`color.roles.<mode>.<role>`). */
export function rolePinField(mode: 'light' | 'dark', role: string): FieldSpec {
  return color(
    ['color', 'roles', mode, role],
    `${capital(words(role))} (${mode})`,
    'Pinned exactly: the solver never moves it, and a pin that breaks contrast is refused.'
  );
}

/** Every section of the document with its form fields (components and variants have their own editors). */
export const SECTIONS: readonly SectionSpec[] = Object.freeze([
  {
    id: 'identity',
    title: 'Identity',
    summary: 'Id, version, name, ownership and the base it extends.',
    fields: [
      {
        path: ['id'],
        label: 'Id',
        kind: 'text',
        placeholder: 'acme',
        help: 'Lowercase letters, digits and single hyphens; at most 64 characters.',
      },
      {
        path: ['version'],
        label: 'Version',
        kind: 'text',
        placeholder: '1.0.0',
        help: 'Strict semver, for example 2.1.0.',
      },
      { path: ['name'], label: 'Name', kind: 'text', placeholder: 'Acme' },
      { path: ['description'], label: 'Description', kind: 'text' },
      { path: ['owner'], label: 'Owner', kind: 'text' },
      { path: ['license'], label: 'License', kind: 'text' },
      {
        path: ['tags'],
        label: 'Tags',
        kind: 'list',
        placeholder: 'fintech, internal',
        help: 'Comma separated; lowercase.',
      },
      {
        path: ['extends'],
        label: 'Extends',
        kind: 'text',
        placeholder: 'texuli:enterprise-neutral',
        help: 'A library theme as texuli:<id>. Other design systems (id@x.y.z) need a resolver this page does not have.',
      },
    ],
  },
  {
    id: 'color',
    title: 'Color',
    summary: 'Seeds, exact brand pins, status colors and modes. Role pins are below.',
    fields: [
      color(['color', 'brand', 'seed'], 'Brand seed', 'The palette is generated from it.'),
      color(['color', 'brand', 'secondary'], 'Secondary seed'),
      color(['color', 'brand', 'accent'], 'Accent seed', 'The hue of the third chart series.'),
      choice(['color', 'brand', 'neutral'], 'Neutral family', NEUTRALS),
      ...PIN_ROLES.map((role) =>
        color(
          ['color', 'pin', role],
          `${capital(role)} pin`,
          role === 'primary'
            ? 'Kept exactly as the fill; the solver derives readable on-colors and tints.'
            : undefined
        )
      ),
      ...STATUS_KEYS.map((key) => color(['color', 'status', key], `${capital(key)} status`)),
      {
        path: ['color', 'modes'],
        label: 'Modes',
        kind: 'modes',
        options: ['light dark', 'light', 'dark'],
      },
      {
        path: ['color', 'dataViz', 'light', 'categorical'],
        label: 'Chart series (light)',
        kind: 'list',
        placeholder: '8 colors, comma separated',
        help: 'Exactly 8 colors, or empty to derive them.',
      },
      {
        path: ['color', 'dataViz', 'dark', 'categorical'],
        label: 'Chart series (dark)',
        kind: 'list',
        placeholder: '8 colors, comma separated',
      },
      {
        path: ['color', 'dataViz', 'cvdSafe'],
        label: 'Warn on color-vision conflicts',
        kind: 'bool',
      },
    ],
  },
  {
    id: 'typography',
    title: 'Typography',
    summary: 'Font stacks, the type scale and the type roles.',
    fields: [
      ...FAMILIES.map(
        (family): FieldSpec => ({
          path: ['typography', 'families', family, 'stack'],
          label: `${capital(family)} stack`,
          kind: 'list',
          placeholder: family === 'mono' ? 'ui-monospace, Menlo' : 'Inter, system-ui',
          help: family === 'sans' ? 'Comma separated, 1 to 8 names; no remote fonts.' : undefined,
        })
      ),
      num(['typography', 'scale', 'base'], 'Base size', 12, 24, 1, 'px'),
      num(['typography', 'scale', 'ratio'], 'Scale ratio', 1.05, 1.618, 0.005),
    ],
  },
  {
    id: 'space',
    title: 'Space and density',
    summary: 'The spacing unit and the density multiplier.',
    fields: [
      num(['space', 'base'], 'Space unit', 2, 8, 0.5, 'px'),
      num(
        ['space', 'density'],
        'Density',
        0.75,
        1.25,
        0.025,
        undefined,
        '0.75 dense to 1.25 spacious.'
      ),
    ],
  },
  {
    id: 'shape',
    title: 'Shape',
    summary: 'Radius, the radius scale and border width.',
    fields: [
      num(['shape', 'radius'], 'Radius', 0, 48, 1, 'px'),
      num(['shape', 'radiusScale'], 'Radius scale', 0, 4, 0.05),
      num(['shape', 'borderWidth'], 'Border width', 0, 4, 0.5, 'px'),
    ],
  },
  {
    id: 'elevation',
    title: 'Elevation and surface',
    summary: 'The shadow style and solid or glass surfaces.',
    fields: [
      choice(['elevation', 'style'], 'Elevation style', [
        'flat',
        'soft',
        'crisp',
        'glow',
        'layered',
      ]),
      choice(['surface', 'style'], 'Surface style', ['solid', 'glass']),
      num(['surface', 'glass', 'alpha'], 'Glass opacity', 0, 1, 0.05),
      num(['surface', 'glass', 'blur'], 'Glass blur', 0, 64, 1, 'px'),
    ],
  },
  {
    id: 'motion',
    title: 'Motion',
    summary: 'Personality, durations and easing.',
    fields: [
      choice(['motion', 'personality'], 'Personality', [
        'none',
        'subtle',
        'standard',
        'expressive',
      ]),
      int(['motion', 'durations', 'fast'], 'Fast duration', 0, 2000, 'ms'),
      int(['motion', 'durations', 'base'], 'Base duration', 0, 2000, 'ms'),
      int(['motion', 'durations', 'slow'], 'Slow duration', 0, 2000, 'ms'),
      choice(['motion', 'easing'], 'Easing', ['standard', 'emphasized', 'enter', 'exit', 'linear']),
    ],
  },
  {
    id: 'layout',
    title: 'Layout and icons',
    summary: 'Content widths, breakpoints, the grid and icon style.',
    fields: [
      int(['layout', 'contentMax'], 'Content width', 320, 2560, 'px'),
      int(['layout', 'wideMax'], 'Wide width', 320, 2560, 'px'),
      ...(['sm', 'md', 'lg'] as const).map((key) =>
        int(['layout', 'breakpoints', key], `Breakpoint ${key}`, 320, 2560, 'px')
      ),
      ...GRID_KEYS.map((key) => int(['layout', 'grid', 'columns', key], `Columns ${key}`, 1, 24)),
      ...GRID_KEYS.map((key) =>
        choice(['layout', 'grid', 'gutter', key], `Gutter ${key}`, SPACE_STEPS)
      ),
      choice(['icons', 'style'], 'Icon style', ['outline', 'filled']),
      num(['icons', 'stroke'], 'Icon stroke', 0.5, 3, 0.05),
      ...(['sm', 'md', 'lg'] as const).map((key) =>
        num(['icons', 'size', key], `Icon size ${key}`, 8, 64, 1, 'px')
      ),
    ],
  },
  {
    id: 'accessibility',
    title: 'Accessibility targets',
    summary:
      'Contrast target, minimum target size and the focus indicator. Enforced, never just reported.',
    fields: [
      choice(['accessibility', 'contrast'], 'Contrast target', ['AA', 'AAA']),
      int(['accessibility', 'targetMin'], 'Minimum target', 24, 64, 'px'),
      choice(['accessibility', 'focus'], 'Focus style', ['ring', 'outline', 'glow', 'inset']),
      num(
        ['accessibility', 'focusWidth'],
        'Focus width',
        1,
        6,
        0.5,
        'px',
        'At least 2 px is required.'
      ),
      num(['accessibility', 'focusOffset'], 'Focus offset', 0, 8, 0.5, 'px'),
    ],
  },
  {
    id: 'voice',
    title: 'Voice',
    summary: 'Tone words, a lexicon and writing guidelines (data only).',
    fields: [
      {
        path: ['voice', 'tone'],
        label: 'Tone',
        kind: 'list',
        placeholder: 'clear, warm',
        help: 'Up to 8 lowercase words.',
      },
      {
        path: ['voice', 'lexicon'],
        label: 'Lexicon',
        kind: 'map',
        placeholder: 'workspace = team space',
        help: 'One entry per line: term = preferred wording.',
      },
      {
        path: ['voice', 'guidelines'],
        label: 'Guidelines',
        kind: 'lines',
        help: 'One per line, up to 12.',
      },
    ],
  },
  {
    id: 'assets',
    title: 'Assets',
    summary: 'Logo and favicon as same-origin relative paths.',
    fields: [
      ...(['light', 'dark', 'mark', 'wordmark'] as const).map(
        (key): FieldSpec => ({
          path: ['assets', 'logo', key],
          label: `Logo ${key}`,
          kind: 'text',
          placeholder: `assets/logo-${key}.svg`,
          help:
            key === 'light'
              ? 'Relative paths only: remote URLs and data URLs are refused for documents from outside the host.'
              : undefined,
        })
      ),
      {
        path: ['assets', 'favicon'],
        label: 'Favicon',
        kind: 'text',
        placeholder: 'assets/favicon.png',
      },
    ],
  },
]);

/* ── Component tokens ──────────────────────────────────────────────────── */

/** Value kinds of component tokens (the spec's `DS_TOKEN_KINDS`). */
export type TokenKind =
  | 'radius'
  | 'dimension'
  | 'type'
  | 'border'
  | 'elevation'
  | 'opacity'
  | 'role'
  | 'stroke';

export const TOKEN_KIND_OPTIONS: Readonly<
  Record<Exclude<TokenKind, 'elevation' | 'stroke'>, readonly string[]>
> = {
  radius: ['none', 'xs', 'sm', 'md', 'lg', 'xl', 'full'],
  dimension: [
    ...SPACE_STEPS,
    'control-xs',
    'control-sm',
    'control-md',
    'control-lg',
    'icon-xs',
    'icon-sm',
    'icon-md',
    'icon-lg',
    'target-min',
    'target-touch',
  ],
  type: TYPE_ROLES,
  border: ['none', 'thin', 'thick'],
  opacity: ['disabled', 'muted', 'scrim'],
  role: ROLES,
};

/**
 * The kind of a component token from its registry default
 * (`@texuli/tokens/components`): the default names the system token family
 * the value steps through.
 */
export function tokenKind(key: string, defaultValue: string): TokenKind {
  if (/shape-radius|radius/.test(defaultValue) || /radius$/.test(key)) return 'radius';
  if (/--tx-type-|--tx-font-|line-height/.test(defaultValue) || /font-|line-height/.test(key))
    return 'type';
  if (/border-width/.test(defaultValue)) return 'border';
  if (/--tx-elevation-/.test(defaultValue) || key === 'elevation') return 'elevation';
  if (/--tx-opacity-/.test(defaultValue)) return 'opacity';
  if (/icon-stroke/.test(defaultValue) || /stroke/.test(key)) return 'stroke';
  if (/--tx-(?:space|size)-|space-unit/.test(defaultValue)) return 'dimension';
  return 'role';
}

/** The form field of one component token. */
export function componentTokenField(component: string, key: string, kind: TokenKind): FieldSpec {
  const path = ['components', component, key];
  const label = capital(words(key));
  if (kind === 'elevation') return int(path, label, 0, 5);
  if (kind === 'stroke') return num(path, label, 0.5, 4, 0.05);
  return choice(path, label, TOKEN_KIND_OPTIONS[kind]);
}

/* ── Reading and writing field values ──────────────────────────────────── */

/** A field's value as the text its control shows. */
export function formatValue(spec: FieldSpec, value: unknown): string {
  if (value === undefined || value === null) return '';
  switch (spec.kind) {
    case 'list':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'lines':
      return Array.isArray(value) ? value.join('\n') : String(value);
    case 'map':
      return isRecord(value)
        ? Object.entries(value)
            .map(([key, entry]) => `${key} = ${String(entry)}`)
            .join('\n')
        : '';
    case 'modes':
      return Array.isArray(value) ? value.join(' ') : '';
    case 'bool':
      return value === true ? 'true' : '';
    default:
      return String(value);
  }
}

/**
 * The document value for a control's text. Empty clears the field. A
 * number that does not parse stays text, so the validator names it with
 * `invalid-type` at its path instead of the studio guessing.
 */
export function parseValue(spec: FieldSpec, text: string): unknown {
  const trimmed = text.trim();
  if (spec.kind === 'bool') return trimmed === 'true' ? true : undefined;
  if (trimmed === '') return undefined;
  switch (spec.kind) {
    case 'number':
    case 'integer': {
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : trimmed;
    }
    case 'list': {
      const items = trimmed
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      return items.length > 0 ? items : undefined;
    }
    case 'lines': {
      const items = trimmed
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
      return items.length > 0 ? items : undefined;
    }
    case 'map': {
      const map: Record<string, string> = {};
      for (const line of trimmed.split('\n')) {
        const match = /^\s*([^=:]+?)\s*[=:]\s*(.*?)\s*$/.exec(line);
        if (!match?.[1] || RESERVED.has(match[1])) continue;
        map[match[1]] = match[2] ?? '';
      }
      return Object.keys(map).length > 0 ? map : undefined;
    }
    case 'modes':
      return trimmed.split(/\s+/);
    default:
      return trimmed;
  }
}

/* ── Issues in plain language ──────────────────────────────────────────── */

/** One problem the studio shows: a stable code, a JSON path and words. */
export interface StudioIssue {
  code: string;
  path: string;
  message: string;
  hint?: string;
  source?: string;
  mode?: string;
}

/** What each code means, in plain language (the spec's, the compiler's, the importers' and the link's). */
export const CODE_EXPLANATIONS: Readonly<Record<string, string>> = Object.freeze({
  'unknown-key': 'This field is not part of the design-system vocabulary.',
  'invalid-type': 'This value has the wrong type (for example text where a number belongs).',
  'invalid-value': 'This value is outside its allowed range, list or form.',
  required: 'This field is required.',
  'format-version': 'The document was written for a format version this studio does not read.',
  'extends-range': 'Extends must name one exact version, never a range.',
  'extends-cycle': 'The extends chain loops back to itself.',
  'extends-depth': 'The extends chain is longer than 4 steps.',
  'url-refused':
    'Only same-origin relative paths are allowed; remote URLs and data URLs are refused for documents from outside the host.',
  'inline-bytes': 'An embedded file is over its size cap.',
  'aa-text': 'A text pair falls below the contrast target, and only pinned colors could fix it.',
  'aa-focus': 'The focus indicator is below 3:1 contrast or narrower than 2 px.',
  'target-size': 'An interactive size is below the minimum target.',
  'invalid-input': 'The file is not in the expected format.',
  'input-limit': 'The file is over the importer’s size or count limits.',
  unmapped: 'A token or key has no place in the design-system document, so it was left out.',
  'unsafe-value': 'A value was refused because it could inject CSS or markup.',
  'reserved-key': 'A reserved key (__proto__, constructor, prototype) was ignored.',
  alias: 'A token alias names nothing, loops, or chains too far.',
  limit: 'Nesting or a long string was cut at its limit.',
  default: 'No brand color was found, so the default seed was used.',
  lossy: 'A field of the source cannot be carried by the document.',
  'share-format': 'The link is not a design-system link.',
  'share-version': 'The link was made by a different studio version.',
  'share-too-long': 'The link is longer than the studio accepts.',
  'share-encoding': 'The link is damaged: its body does not decode.',
  'share-too-large': 'The link expands into more data than the studio accepts.',
  'share-json': 'The link does not hold a JSON object.',
  'share-unsupported': 'This browser cannot compress or decompress links.',
  'engine-failed': 'The studio could not load its compiler from this site.',
});

/** The plain-language sentence for a code (falls back to the code). */
export function explainCode(code: string): string {
  return CODE_EXPLANATIONS[code] ?? `Refused with code ${code}.`;
}

/** The issues that belong to a field: at its path or below it. */
export function issuesAt(issues: readonly StudioIssue[], path: Path): StudioIssue[] {
  const at = issuePath(path);
  return issues.filter(
    (issue) =>
      !issue.source &&
      (issue.path === at || issue.path.startsWith(`${at}.`) || issue.path.startsWith(`${at}[`))
  );
}

/** Normalize any issue-like value (spec, compiler, importer) into a studio issue. */
export function toStudioIssue(value: unknown): StudioIssue {
  const record = isRecord(value) ? value : {};
  const text = (key: string) =>
    typeof record[key] === 'string' ? (record[key] as string) : undefined;
  return {
    code: text('code') ?? 'invalid-value',
    path: text('path') ?? '$',
    message: text('message') ?? '',
    ...(text('hint') ? { hint: text('hint') } : {}),
    ...(text('source') ? { source: text('source') } : {}),
    ...(text('mode') ? { mode: text('mode') } : {}),
  };
}

/* ── Imports ───────────────────────────────────────────────────────────── */

export type ImportKind = 'design-system' | 'dtcg' | 'tokens-studio' | 'role-palette';

export const IMPORT_KIND_LABELS: Readonly<Record<ImportKind, string>> = {
  'design-system': 'design-system JSON',
  dtcg: 'W3C DTCG tokens',
  'tokens-studio': 'Tokens Studio file',
  'role-palette': 'flat role palette',
};

/** The largest file the studio reads (the importers' default cap). */
export const MAX_IMPORT_BYTES = 1_048_576;

/** Which importer reads a parsed JSON file. */
export function detectImportKind(value: unknown): ImportKind {
  if (!isRecord(value)) return 'dtcg';
  if (value.format === DS_FORMAT) return 'design-system';
  if (isRecord(value.$metadata) || Array.isArray(value.$themes)) return 'tokens-studio';
  if (isRecord(value.light) && isRecord(value.dark) && typeof value.light.primary === 'string') {
    return 'role-palette';
  }
  return 'dtcg';
}

/* ── Exports ───────────────────────────────────────────────────────────── */

export type ExportFormat =
  | 'document'
  | 'compiled'
  | 'css'
  | 'tailwind'
  | 'dtcg'
  | 'tokens-studio'
  | 'report'
  | 'email';

export interface ExportSpec {
  id: ExportFormat;
  label: string;
  suffix: string;
  mime: string;
  description: string;
}

export const EXPORT_FORMATS: readonly ExportSpec[] = Object.freeze([
  {
    id: 'document',
    label: 'Design system JSON',
    suffix: '.design-system.json',
    mime: 'application/json',
    description: 'The document itself: the source of truth to keep in your repository.',
  },
  {
    id: 'compiled',
    label: 'Compiled JSON',
    suffix: '.compiled.json',
    mime: 'application/json',
    description: 'Concrete variables per mode, attributes, defaults and the report.',
  },
  {
    id: 'css',
    label: 'Scoped CSS',
    suffix: '.css',
    mime: 'text/css',
    description: 'Custom properties on [data-tx-ds], with the dark mode under .dark.',
  },
  {
    id: 'tailwind',
    label: 'Tailwind preset',
    suffix: '.tailwind-preset.json',
    mime: 'application/json',
    description: 'theme.extend colors, radii, fonts, spacing and shadows reading the variables.',
  },
  {
    id: 'dtcg',
    label: 'DTCG tokens',
    suffix: '.tokens.json',
    mime: 'application/json',
    description: 'W3C Design Tokens; imports back without loss.',
  },
  {
    id: 'tokens-studio',
    label: 'Tokens Studio',
    suffix: '.tokens-studio.json',
    mime: 'application/json',
    description: 'Global, light and dark sets for the Tokens Studio plugin.',
  },
  {
    id: 'report',
    label: 'Report HTML',
    suffix: '.report.html',
    mime: 'text/html',
    description: 'A static review page: swatches, type ramp, component sheet and contrast table.',
  },
  {
    id: 'email',
    label: 'Sample email HTML',
    suffix: '.email.html',
    mime: 'text/html',
    description: 'A sample digest rendered by @texuli/tools/email with this design system.',
  },
]);

/** A safe file name for an export (the id is validated, but files never trust it). */
export function exportFileName(id: unknown, format: ExportFormat): string {
  const spec = EXPORT_FORMATS.find((entry) => entry.id === format);
  const base =
    typeof id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(id) ? id : STUDIO_DOCUMENT_ID;
  return `${base}${spec?.suffix ?? '.txt'}`;
}

/* ── Contrast summary ──────────────────────────────────────────────────── */

export interface PairRow {
  foreground: string;
  background: string;
  kind: string;
  ratio: number;
  required: number;
  pass: boolean;
}

/** Counts for the live announcement and the summary line. */
export function contrastSummary(
  contrast: Partial<Record<'light' | 'dark', readonly PairRow[]>>
): { mode: 'light' | 'dark'; total: number; failing: number; lowest: number }[] {
  const out: { mode: 'light' | 'dark'; total: number; failing: number; lowest: number }[] = [];
  for (const mode of ['light', 'dark'] as const) {
    const rows = contrast[mode];
    if (!rows) continue;
    out.push({
      mode,
      total: rows.length,
      failing: rows.filter((row) => !row.pass).length,
      lowest: rows.reduce((low, row) => Math.min(low, row.ratio), Number.POSITIVE_INFINITY),
    });
  }
  return out;
}

/** `--tx-primary-foreground` → `primary foreground`. */
export function variableLabel(name: string): string {
  return name.replace(/^--tx-/, '').replace(/-/g, ' ');
}

type PreviewMode = 'light' | 'dark';

/**
 * The preview modes a compiled design system offers: the modes it compiled
 * (`color.modes: ["dark"]` offers dark only). Before the first compile, both.
 */
export function previewModes(
  compiled: Pick<ApplicableDesignSystem, 'vars'> | null | undefined
): PreviewMode[] {
  const modes = (['light', 'dark'] as const).filter((mode) => compiled?.vars?.[mode]);
  return compiled && modes.length > 0 ? modes : ['light', 'dark'];
}

/**
 * The mode the preview paints and the toggle shows for the one chosen: the
 * runtime's rule (`pickDesignSystemMode`), so a dark-only design system
 * previews dark with Dark pressed. Never throws: with no compiled mode it is
 * the chosen one.
 */
export function previewMode(
  compiled: Pick<ApplicableDesignSystem, 'vars'> | null | undefined,
  mode: PreviewMode
): PreviewMode {
  if (!compiled) return mode;
  try {
    return pickDesignSystemMode(compiled, mode);
  } catch {
    return mode;
  }
}
