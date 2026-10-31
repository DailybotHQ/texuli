/**
 * The design-system operations (T-ds-agent-tools, architecture B.8): an
 * agent validates, compiles, checks, suggests, imports, diffs, previews and
 * saves a design-system document ([the document](../../../spec/docs/design-system.md))
 * through any door. Every `ds.*` operation but `ds.save` is `edge`: pure,
 * deterministic compute that runs the same locally and on the remote
 * endpoint. `ds.save` is `node`: it writes only to the explicit path the
 * caller passes, inside the working directory, through the door's local
 * writer. A refused document is a normal result (`valid: false`) whose
 * `errors` carry the spec's and the compiler's stable codes and JSON paths.
 *
 * The handlers load `design-system-run.ts` lazily: the compiler, the
 * importers and the emitters are not in a door's initial bundle.
 */
import { defineOperation } from './registry.ts';
import type { JsonSchema } from './schema.ts';
import { type Operation, OperationError } from './types.ts';

const run = () => import('./design-system-run.ts');

/**
 * The largest JSON input a design-system operation takes: the importers'
 * cap (`DESIGN_SYSTEM_IMPORT_LIMITS.bytes`, 1 MiB), written out so the
 * importers stay out of the initial bundle (a test keeps them equal).
 */
export const DS_INPUT_BYTES = 1_048_576;
/** The most RGBA values `ds.suggest` takes as logo pixels (128 × 128 pixels). */
export const DS_PIXEL_VALUES = 65_536;
const TIME_MS = 10_000;

/** The spec's smallest document (`packages/spec/fixtures/design-systems/minimal.json`). */
export const MINIMAL_DESIGN_SYSTEM = Object.freeze({
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'minimal',
  version: '1.0.0',
  name: 'Minimal',
  color: { brand: { seed: '#4f46e5' } },
});

/** A fictional brand on a library base: a pinned primary and a type stack. */
const EXAMPLE_BRAND = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'harborline',
  version: '1.1.0',
  name: 'Harborline',
  extends: 'texuli:ocean',
  color: { brand: { seed: '#0e7490' } },
  shape: { radius: 10 },
  typography: { families: { sans: { stack: ['Inter', 'system-ui', 'sans-serif'] } } },
};

const READ_ONLY = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  openWorld: false,
} as const;

const DOCUMENT: JsonSchema = {
  type: 'object',
  description:
    'A design-system document: format "texuli/design-system", formatVersion 1, id, version, name, and optional sections (extends, color, typography, shape, space, elevation, surface, motion, layout, icons, components, assets, voice, accessibility, variants). texuli://design-system/acme is a full example.',
};
const TRUST: JsonSchema = {
  type: 'string',
  enum: ['untrusted', 'developer'],
  default: 'untrusted',
  description:
    'untrusted (agent or user documents, the default) refuses every data: URL; developer accepts capped data: fonts and images.',
};
const VARIANT: JsonSchema = {
  type: 'string',
  maxLength: 64,
  pattern: '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
  description: 'A variant the document declares under variants (e.g. "high-contrast").',
};
const BASES: JsonSchema = {
  type: 'object',
  additionalProperties: { type: 'object' },
  description:
    'Documents for extends: "id@x.y.z", keyed by "id@version". "texuli:<theme>" bases load from the theme library; nothing is fetched.',
};
const MODE: JsonSchema = {
  type: 'string',
  enum: ['light', 'dark'],
  description: 'Compile one mode only (default: every mode the document declares).',
};
const ISSUE: JsonSchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    path: { type: 'string' },
    message: { type: 'string' },
    hint: { type: 'string' },
    source: { type: 'string' },
    variant: { type: 'string' },
    mode: { type: 'string' },
    pairs: { type: 'array', items: { type: 'object' } },
  },
  required: ['code', 'path', 'message'],
};
const ISSUES: JsonSchema = { type: 'array', items: ISSUE };
const WARNINGS: JsonSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: { code: { type: 'string' }, path: { type: 'string' }, message: { type: 'string' } },
    required: ['path', 'message'],
  },
};
const IDENTITY = {
  id: { type: 'string' },
  version: { type: 'string' },
  name: { type: 'string' },
  hash: { type: 'string', pattern: '^[0-9a-f]{64}$' },
} as const;
const COLOR: JsonSchema = {
  type: 'string',
  maxLength: 32,
  pattern: '^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|oklch\\([0-9. %/]+\\))$',
  description: 'A color: #rgb, #rrggbb, #rrggbbaa or a numeric oklch(L C H).',
};
const IDENTITY_INPUT: Record<string, JsonSchema> = {
  id: {
    type: 'string',
    maxLength: 64,
    pattern: '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
    description: 'The id of the resulting document (lowercase words joined by hyphens).',
  },
  version: {
    type: 'string',
    maxLength: 64,
    pattern: '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$',
    description: 'The semver version of the resulting document (default 1.0.0).',
  },
  name: {
    type: 'string',
    maxLength: 80,
    description: 'The display name of the resulting document.',
  },
};
/** The common options of every operation that compiles a document. */
const COMPILE_INPUT: Record<string, JsonSchema> = {
  trust: TRUST,
  variant: VARIANT,
  bases: BASES,
};

export const dsValidate: Operation = defineOperation({
  name: 'ds.validate',
  title: 'Validate a design system',
  summary:
    "Validate a design-system document: the spec's closed schema, the extends chain, then a compile of the document and its high-contrast variant with the guarantees enforced (text contrast, focus ring, target size). Returns valid, the distinct codes, every error with its JSON path and hint, the compiler warnings and the hash.",
  input: {
    type: 'object',
    properties: { document: DOCUMENT, ...COMPILE_INPUT },
    required: ['document'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      ...IDENTITY,
      codes: { type: 'array', items: { type: 'string' } },
      errors: ISSUES,
      warnings: WARNINGS,
      variants: { type: 'array', items: { type: 'string' } },
    },
    required: ['valid', 'codes', 'errors', 'warnings', 'variants'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: DS_INPUT_BYTES, timeMs: TIME_MS },
  examples: [
    { title: 'The smallest document', input: { document: MINIMAL_DESIGN_SYSTEM } },
    {
      title: 'A document that pins an unreadable foreground',
      input: {
        document: {
          ...MINIMAL_DESIGN_SYSTEM,
          id: 'low-contrast',
          color: {
            brand: { seed: '#4f46e5' },
            roles: { light: { background: '#ffffff', foreground: '#eeeeee' } },
          },
        },
      },
    },
  ],
  async handler(input) {
    return (await run()).runValidate(input);
  },
});

export const dsCompile: Operation = defineOperation({
  name: 'ds.compile',
  title: 'Compile a design system',
  summary:
    'Compile a design-system document to concrete --tx-* variables per mode and emit one format: compiled JSON, scoped CSS, a Tailwind preset, DTCG or Tokens Studio. Returns valid, the format, its media type, the content as text, the hash and warnings; a refused document returns errors with stable codes instead.',
  input: {
    type: 'object',
    properties: {
      document: DOCUMENT,
      format: {
        type: 'string',
        enum: ['json', 'css', 'tailwind', 'dtcg', 'tokens-studio'],
        default: 'json',
        description:
          'json (the compiled design system, keys sorted), css (scoped custom properties, light and dark), tailwind (a preset), dtcg or tokens-studio (the document as token files).',
      },
      selector: {
        type: 'string',
        maxLength: 200,
        description: 'css only: the scope selector (default [data-tx-ds="<id>"], or :root).',
      },
      dark: {
        type: 'string',
        enum: ['class', 'attribute', 'media'],
        description:
          'css only: dark mode through the .dark class (default), [data-tx-mode="dark"] or prefers-color-scheme.',
      },
      mode: MODE,
      ...COMPILE_INPUT,
    },
    required: ['document'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      format: { type: 'string' },
      mediaType: { type: 'string' },
      ...IDENTITY,
      variant: { type: 'string' },
      bytes: { type: 'integer', minimum: 0 },
      content: { type: 'string' },
      errors: ISSUES,
      warnings: WARNINGS,
    },
    required: ['valid', 'format', 'errors', 'warnings'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: DS_INPUT_BYTES, timeMs: TIME_MS },
  examples: [
    { title: 'Scoped CSS', input: { document: MINIMAL_DESIGN_SYSTEM, format: 'css' } },
    { title: 'A Tailwind preset', input: { document: EXAMPLE_BRAND, format: 'tailwind' } },
  ],
  async handler(input) {
    return (await run()).runCompile(input);
  },
});

export const dsContrast: Operation = defineOperation({
  name: 'ds.contrast',
  title: 'Report design-system contrast',
  summary:
    'Compile a design-system document and report every contrast pair the guarantees check, per mode: foreground and background roles, kind (text, ui, focus), ratio, requirement and pass, plus the solver adjustments. Returns valid, the target (AA or AAA), targetMin and the per-mode pairs, or errors with stable codes.',
  input: {
    type: 'object',
    properties: { document: DOCUMENT, mode: MODE, ...COMPILE_INPUT },
    required: ['document'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      ...IDENTITY,
      contrast: { type: 'string', enum: ['AA', 'AAA'] },
      targetMin: { type: 'number' },
      modes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            mode: { type: 'string' },
            total: { type: 'integer', minimum: 0 },
            failing: { type: 'integer', minimum: 0 },
            pairs: { type: 'array', items: { type: 'object' } },
          },
          required: ['mode', 'total', 'failing', 'pairs'],
        },
      },
      adjustments: { type: 'array', items: { type: 'object' } },
      errors: ISSUES,
    },
    required: ['valid', 'modes', 'adjustments', 'errors'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: DS_INPUT_BYTES, timeMs: TIME_MS },
  examples: [{ title: 'Both modes of a brand', input: { document: EXAMPLE_BRAND } }],
  async handler(input) {
    return (await run()).runContrast(input);
  },
});

export const dsSuggest: Operation = defineOperation({
  name: 'ds.suggest',
  title: 'Suggest a design system',
  summary:
    'Suggest a starting design-system document from one seed color, up to three brand colors (seed, secondary, accent) or a logo as RGBA pixels (the dominant colors pick the seed). Returns valid, the document, the dominant palette for pixels, the key tokens of each mode and warnings.',
  input: {
    type: 'object',
    properties: {
      seed: COLOR,
      colors: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        items: COLOR,
        description: 'Up to 3 brand colors: the seed, then the secondary, then the accent.',
      },
      pixels: {
        type: 'array',
        maxItems: DS_PIXEL_VALUES,
        items: { type: 'integer', minimum: 0, maximum: 255 },
        description: `A logo as RGBA values 0 to 255, 4 per pixel, row by row (at most ${DS_PIXEL_VALUES} values, 128 × 128 pixels); transparent pixels are ignored.`,
      },
      count: {
        type: 'integer',
        minimum: 2,
        maximum: 12,
        default: 6,
        description: 'pixels only: how many dominant colors to report (2 to 12, default 6).',
      },
      ...IDENTITY_INPUT,
      trust: TRUST,
    },
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      document: { type: 'object' },
      palette: {
        type: 'array',
        items: {
          type: 'object',
          properties: { color: { type: 'string' }, weight: { type: 'number' } },
          required: ['color', 'weight'],
        },
      },
      roles: { type: 'object', additionalProperties: { type: 'object' } },
      hash: { type: 'string' },
      errors: ISSUES,
      warnings: WARNINGS,
    },
    required: ['valid', 'palette', 'errors', 'warnings'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: DS_INPUT_BYTES, items: DS_PIXEL_VALUES, timeMs: TIME_MS },
  examples: [
    { title: 'From one seed', input: { seed: '#0e7490', id: 'harborline', name: 'Harborline' } },
    { title: 'From three brand colors', input: { colors: ['#4f46e5', '#0891b2', '#f59e0b'] } },
    {
      title: 'From a two-color logo (4 pixels)',
      input: {
        pixels: [14, 116, 144, 255, 14, 116, 144, 255, 14, 116, 144, 255, 245, 158, 11, 255],
      },
    },
  ],
  async handler(input) {
    return (await run()).runSuggest(input);
  },
});

export const dsImport: Operation = defineOperation({
  name: 'ds.import',
  title: 'Import a design system',
  summary:
    'Turn what a team already has into a valid design-system document: a brand one-liner ("brand #4f46e5, font Inter, rounded, compact"), a W3C DTCG file, a Tokens Studio file, a flat role palette or a Texuli theme (an object, or a library theme id). Returns valid, the document and warnings for every value it dropped, or errors with stable codes.',
  input: {
    type: 'object',
    properties: {
      from: {
        type: 'string',
        enum: ['brand', 'dtcg', 'tokens-studio', 'role-palette', 'theme'],
        description:
          'The source format: brand (text), dtcg, tokens-studio, role-palette (objects or JSON text) or theme (a Theme object or a library theme id).',
      },
      input: {
        type: ['string', 'object'],
        maxLength: DS_INPUT_BYTES,
        description:
          'The source: the one-liner for brand, a library theme id or Theme for theme, else the token file as an object or JSON text.',
      },
      ...IDENTITY_INPUT,
      trust: TRUST,
    },
    required: ['from', 'input'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      from: { type: 'string' },
      document: { type: 'object' },
      errors: ISSUES,
      warnings: WARNINGS,
    },
    required: ['valid', 'from', 'errors', 'warnings'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: DS_INPUT_BYTES, timeMs: TIME_MS },
  examples: [
    {
      title: 'A brand one-liner',
      input: {
        from: 'brand',
        input: 'name Harborline, brand #0e7490, accent #f59e0b, font Inter, rounded, compact',
      },
    },
    {
      title: 'A DTCG file',
      input: {
        from: 'dtcg',
        input: {
          brand: { $type: 'color', $value: '#0e7490' },
          shape: { radius: { $type: 'dimension', $value: '10px' } },
        },
        id: 'harborline',
      },
    },
    { title: 'A library theme', input: { from: 'theme', input: 'ocean' } },
  ],
  async handler(input) {
    return (await run()).runImport(input);
  },
});

export const dsDiff: Operation = defineOperation({
  name: 'ds.diff',
  title: 'Diff two design systems',
  summary:
    'Compile two design-system documents (before is the baseline) and compare them: every added, removed or changed --tx-* variable per mode, contrast pairs that regressed below the target, changed component defaults and attributes. Returns valid, identical, the summary counts and each list, or errors tagged with their side.',
  input: {
    type: 'object',
    properties: {
      before: { ...DOCUMENT, description: 'The baseline design-system document.' },
      after: { ...DOCUMENT, description: 'The changed design-system document.' },
      mode: MODE,
      ...COMPILE_INPUT,
    },
    required: ['before', 'after'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      before: { type: 'object' },
      after: { type: 'object' },
      identical: { type: 'boolean' },
      summary: { type: 'object' },
      tokens: { type: 'array', items: { type: 'object' } },
      contrast: { type: 'array', items: { type: 'object' } },
      defaults: { type: 'array', items: { type: 'object' } },
      attrs: { type: 'array', items: { type: 'object' } },
      errors: ISSUES,
    },
    required: ['valid', 'errors'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: DS_INPUT_BYTES, timeMs: TIME_MS },
  examples: [
    {
      title: 'A new seed color',
      input: {
        before: MINIMAL_DESIGN_SYSTEM,
        after: {
          ...MINIMAL_DESIGN_SYSTEM,
          version: '1.1.0',
          color: { brand: { seed: '#b91c1c' } },
        },
      },
    },
  ],
  async handler(input) {
    return (await run()).runDiff(input);
  },
});

export const dsPreview: Operation = defineOperation({
  name: 'ds.preview',
  title: 'Preview a design system',
  summary:
    'Render a static, deterministic snapshot of a compiled design system: svg (swatches, a button and a card per mode) or html (the review report: swatches, type ramp, component sheet, contrast table and adjustments). Fixed fonts, no time, no scripts; every value escaped. Returns valid, the format, media type, content and hash.',
  input: {
    type: 'object',
    properties: {
      document: DOCUMENT,
      format: {
        type: 'string',
        enum: ['svg', 'html'],
        default: 'svg',
        description: 'svg (a compact image, the default) or html (the full review report page).',
      },
      title: { type: 'string', maxLength: 120, description: 'html only: the page title.' },
      mode: MODE,
      ...COMPILE_INPUT,
    },
    required: ['document'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      format: { type: 'string', enum: ['svg', 'html'] },
      mediaType: { type: 'string' },
      ...IDENTITY,
      bytes: { type: 'integer', minimum: 0 },
      content: { type: 'string' },
      errors: ISSUES,
    },
    required: ['valid', 'format', 'errors'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: DS_INPUT_BYTES, timeMs: TIME_MS },
  examples: [{ title: 'An SVG snapshot', input: { document: MINIMAL_DESIGN_SYSTEM } }],
  async handler(input) {
    return (await run()).runPreview(input);
  },
});

export const dsSave: Operation = defineOperation({
  name: 'ds.save',
  title: 'Save a design system to a file',
  summary:
    'Validate a design-system document (as ds.validate does) and write it as two-space JSON to the explicit .json path you pass, inside the working directory: traversal, symlinks, dot directories and dotfiles, node_modules, package.json and an existing file without overwrite are refused. Local doors only. Returns saved, the relative path and bytes written, or errors with stable codes.',
  input: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        minLength: 1,
        maxLength: 1024,
        description:
          'Where to write, relative to the working directory (e.g. design-systems/harborline.ds.json): a .json file outside dot directories and node_modules, never package.json.',
      },
      document: DOCUMENT,
      overwrite: {
        type: 'boolean',
        default: false,
        description: 'Replace an existing file (default false: an existing file is refused).',
      },
      dryRun: {
        type: 'boolean',
        default: false,
        description: 'Validate the document and the path, and write nothing.',
      },
      ...COMPILE_INPUT,
    },
    required: ['path', 'document'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      saved: { type: 'boolean' },
      dryRun: { type: 'boolean' },
      path: { type: 'string' },
      bytes: { type: 'integer', minimum: 0 },
      errors: ISSUES,
    },
    required: ['saved', 'errors'],
  },
  annotations: { readOnly: false, destructive: true, idempotent: true, openWorld: true },
  runtime: 'node',
  limits: { inputBytes: DS_INPUT_BYTES, timeMs: TIME_MS },
  examples: [
    {
      title: 'Check where the minimal document would go',
      input: {
        path: 'design-systems/minimal.ds.json',
        document: MINIMAL_DESIGN_SYSTEM,
        dryRun: true,
      },
    },
  ],
  async handler(input, context) {
    if (!context.files)
      throw new OperationError(
        'runtime-unavailable',
        'ds.save needs a door that writes local files (texuli-mcp or the texuli CLI).'
      );
    return (await run()).runSave(input, context.files);
  },
});
