/**
 * The closed vocabulary of a design-system document (ADR-021), as a compact
 * table: the validator walks it, and `scripts/design-system-schema.ts`
 * projects it into `schemas/design-system.schema.json` (TypeScript and
 * Kotlin types follow from that schema). Kept as data, not a bundled JSON
 * Schema, so `@texuli/spec/design-system` stays a few KB.
 *
 * A node is a `$defs` name (a string), a closed object (a key ending in `!`
 * is required), or a tagged tuple:
 * `['e', 'a b']` enum · `['n' | 'i', min, max]` number or integer ·
 * `['s', pattern, maxLength]` string · `['t', maxLength]` text without
 * control or bidi characters · `['l', item, min, max, unique?]` list ·
 * `['m', value, maxEntries, keyPattern]` map · `['b']` boolean ·
 * `['k', value]` constant · `['u', 'i' | 'f', capBytes]` an image or font
 * source · `['x']` an `extends` reference.
 */

export type DsNode =
  | string
  | { readonly [key: string]: DsNode }
  | readonly ['e', string]
  | readonly ['n' | 'i', number, number]
  | readonly ['s', RegExp, number]
  | readonly ['t', number]
  | readonly ['l', DsNode, number, number, 1?]
  | readonly ['m', DsNode, number, RegExp]
  | readonly ['b']
  | readonly ['k', string | number]
  | readonly ['u', 'i' | 'f', number]
  | readonly ['x'];

export type DsObject = { readonly [key: string]: DsNode };

export const DESIGN_SYSTEM_FORMAT = 'texuli/design-system';
export const DESIGN_SYSTEM_FORMAT_VERSION = 1;

/** Stable codes `validate` and `migrate` raise (ADR-021). */
export const DESIGN_SYSTEM_CODES = [
  'unknown-key',
  'invalid-type',
  'invalid-value',
  'required',
  'format-version',
  'extends-range',
  'extends-cycle',
  'extends-depth',
  'url-refused',
  'inline-bytes',
] as const;

/** Guarantee codes the compiler raises (ADR-022); reserved here, never raised by the spec. */
export const DESIGN_SYSTEM_COMPILER_CODES = ['aa-text', 'aa-focus', 'target-size'] as const;

export type DesignSystemCode =
  | (typeof DESIGN_SYSTEM_CODES)[number]
  | (typeof DESIGN_SYSTEM_COMPILER_CODES)[number];

/** Caps: visited values, depth, errors, the `extends` chain and inline bytes (decoded). */
export const DESIGN_SYSTEM_LIMITS = Object.freeze({
  values: 20_000,
  depth: 16,
  errors: 64,
  extendsDepth: 4,
  logo: 32_768,
  favicon: 8_192,
  font: 131_072,
  inlineTotal: 262_144,
});

const ID = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
const SEMVER =
  '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?';
const NUM = '(?:\\d{1,3}(?:\\.\\d{1,6})?|\\.\\d{1,6})';
const PATH = '(?:\\.?\\/)?(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\\.';

/** Shared patterns (also written into the schema). */
export const DS_PATTERNS = {
  id: new RegExp(`^${ID}$`),
  semver: new RegExp(`^${SEMVER}$`),
  ref: new RegExp(`^(?:texuli:${ID}|${ID}@${SEMVER})$`),
  color: new RegExp(
    `^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|oklch\\(${NUM}%? ${NUM} ${NUM}(?: \\/ ${NUM}%?)?\\))$`
  ),
  image: new RegExp(`^${PATH}(?:png|jpe?g|gif|webp|avif|svg|ico)$`),
  font: new RegExp(`^${PATH}(?:woff2?|ttf|otf)$`),
  // Free text refuses control, bidi and invisible characters: the tokens
  // importers' set (C0, C1, soft hyphen, Arabic letter mark, Mongolian vowel
  // separator, zero-width space, non-joiner and joiner, LRM and RLM, word
  // joiner and invisible operators, bidi embeddings, overrides and isolates,
  // byte order mark), plus the line and paragraph separators and the tag
  // characters. The schema compiles patterns with the `u` flag.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: text refuses control, bidi and invisible characters
  text: /^[^\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff\u{e0000}-\u{e007f}]*$/u,
  key: /^[a-z][a-z0-9-]{0,47}$/,
};

const P = DS_PATTERNS;
const color = 'colorValue';
const keys = (names: string, node: DsNode): DsObject =>
  Object.fromEntries(names.split(' ').map((name) => [name, node]));

/** Map keys no map may use, whatever its pattern. */
export const DS_RESERVED_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/** The semantic roles of `@texuli/tokens` (`SEMANTIC_ROLES`); a test keeps them equal. */
export const DS_ROLES =
  'background foreground surface surfaceForeground elevated elevatedForeground muted mutedForeground subtle subtleForeground border borderStrong input ring primary primaryForeground primarySoft primarySoftForeground secondary secondaryForeground accent accentForeground destructive destructiveForeground destructiveSoft destructiveSoftForeground success successForeground successSoft successSoftForeground warning warningForeground warningSoft warningSoftForeground info infoForeground infoSoft infoSoftForeground sidebar sidebarForeground sidebarBorder sidebarPrimary overlay scrim shadow link linkVisited selection selectionForeground canvas';

/** Component token kinds: the letter in {@link DS_COMPONENT_TOKENS} → its value `$defs`. */
export const DS_TOKEN_KINDS: Readonly<Record<string, string>> = {
  r: 'radiusStep',
  d: 'dimension',
  t: 'typeRoleName',
  b: 'borderStep',
  e: 'elevationLevel',
  o: 'opacityStep',
  c: 'roleName',
  k: 'strokeWidth',
};

/**
 * Every component of the token registry (`COMPONENT_TOKEN_FAMILIES` of
 * `@texuli/tokens`, z-index tokens left out) and the defaults vocabulary
 * (`DESIGN_DEFAULTS_VOCABULARY` of `texuli`): `key:kind` pairs. A test
 * keeps it equal to both.
 */
export const DS_COMPONENT_TOKENS: Readonly<Record<string, string>> = {
  accordion:
    'trigger-gap:d trigger-padding-block:d trigger-font-size:t trigger-font-weight:t disabled-opacity:o',
  alert: 'radius:r border-width:b padding-block:d padding-inline:d gap:d font-size:t icon-size:d',
  'aspect-ratio': 'radius:r',
  avatar: 'size-xs:d size-sm:d size-md:d size-lg:d radius:r font-weight:t',
  badge:
    'radius:r padding-block:d padding-inline:d gap:d font-size:t font-weight:t line-height:t border-width:b',
  board: 'column-gap:d column-radius:r column-padding:d card-radius:r card-elevation:e',
  breadcrumb: '',
  button:
    'height-sm:d height-md:d height-lg:d height-touch:d padding-inline-sm:d padding-inline-md:d padding-inline-lg:d gap:d radius:r font-size:t font-size-sm:t font-size-lg:t font-weight:t line-height:t icon-size:d border-width:b elevation:e disabled-opacity:o',
  'canvas-toolbar': 'gap:d padding:d button-radius:r button-font-size:t',
  card: 'radius:r border-width:b elevation:e padding-inline:d padding-block:d background:c title-font-size:t title-font-weight:t title-line-height:t description-font-size:t',
  carousel: 'radius:r fallback-padding:d',
  'chart-frame': 'title-font-size:t',
  'chat-bubble': 'radius:r tail-radius:r padding-block:d padding-inline:d',
  'chat-composer': 'radius:r padding:d gap:d',
  chip: '',
  choice:
    'gap:d switch-gap:d label-font-size:t label-font-weight:t description-font-size:t disabled-opacity:o',
  code: 'font-size:t font-weight:t block-padding-block:d block-padding-inline:d block-radius:r block-line-height:t block-border-width:b',
  'color-picker': 'gap:d swatch-size:d swatch-radius:r',
  combobox:
    'height-sm:d height-md:d height-lg:d radius:r border-width:b font-size-sm:t font-size-md:t font-size-lg:t',
  command:
    'radius:r border-width:b font-size-sm:t font-size-md:t font-size-lg:t input-gap:d input-padding-inline:d',
  'copy-button': '',
  'data-grid': 'gap:d radius:r pager-font-size:t',
  date: 'font-size:t label-font-weight:t control-radius:r control-border-width:b panel-padding:d panel-radius:r panel-elevation:e description-font-size:t',
  dialog:
    'radius:r border-width:b elevation:e font-size:t line-height:t title-font-size:t title-font-weight:t title-line-height:t alert-padding:d scrim-opacity:o',
  empty:
    'gap:d padding-inline:d padding-block:d title-font-size:t title-font-weight:t description-font-size:t',
  field:
    'gap:d label-font-size:t label-font-weight:t label-line-height:t description-font-size:t description-line-height:t',
  'file-upload':
    'gap:d zone-padding-block:d zone-padding-inline:d zone-border-width:b zone-radius:r browse-height:d',
  forms: 'gap:d',
  icon: 'size-xs:d size-sm:d size-md:d size-lg:d stroke-width:k',
  'icon-button': '',
  input:
    'height:d height-touch:d padding-block:d padding-inline:d radius:r border-width:b elevation:e font-size:t font-size-touch:t font-weight:t textarea-padding-block:d disabled-opacity:o',
  kbd: 'min-size:d padding-block:d radius:r border-width:b font-weight:t',
  label: '',
  menu: 'trigger-height-sm:d trigger-height-md:d trigger-height-lg:d trigger-radius:r trigger-border-width:b trigger-font-size:t trigger-font-weight:t content-padding-block:d content-radius:r content-elevation:e content-font-size:t',
  navigation: 'font-size:t list-gap:d trigger-radius:r chevron-opacity:o',
  'number-field': 'radius:r border-width:b padding-block:d padding-inline:d stepper-size:d',
  pagination: '',
  'pin-input': 'gap:d cell-inline-size:d cell-block-size:d cell-radius:r cell-font-size:t',
  popover:
    'padding-block:d padding-inline:d radius:r border-width:b elevation:e font-size:t title-font-size:t title-font-weight:t title-line-height:t',
  progress: 'gap:d font-size:t radius:r track-height-sm:d track-height-md:d track-height-lg:d',
  'radio-group': '',
  rating: 'stars-gap:d label-font-size:t label-font-weight:t star-radius:r',
  resizable: 'radius:r border-width:b',
  'resizable-handle': '',
  'scroll-area':
    'radius:r border-width:b padding:d scrollbar-size:d scrollbar-radius:r thumb-min-size:d',
  select:
    'height-sm:d height-md:d height-lg:d padding-inline-sm:d padding-inline-md:d padding-inline-lg:d gap:d radius:r border-width:b font-size-sm:t font-size-md:t font-size-lg:t font-weight:t chevron-size:d chevron-opacity:o',
  separator: 'thickness:b',
  sheet:
    'gap:d padding:d border-width:b elevation:e font-size:t line-height:t title-font-size:t title-font-weight:t title-line-height:t scrim-opacity:o',
  sidebar:
    'font-size:t inset-radius:r header-padding-inline:d header-gap:d body-gap:d body-padding-block:d body-padding-inline:d',
  skeleton: 'radius:r height-sm:d height-md:d height-lg:d circle-size:d',
  slider: 'thumb-border-width:b thumb-elevation:e disabled-opacity:o',
  spinner: 'radius:r',
  spreadsheet: 'gap:d tab-radius:r tab-padding-inline:d bar-radius:r',
  stat: 'gap:d padding:d radius:r border-width:b elevation:e label-font-size:t label-font-weight:t value-font-size:t value-font-weight:t icon-size:d icon-radius:r',
  stepper:
    'gap:d trigger-radius:r marker-size:d marker-radius:r marker-border-width:b marker-font-size:t marker-font-weight:t check-size:d',
  table: 'radius:r border-width:b font-size:t head-font-size:t head-font-weight:t',
  tabs: 'gap:d list-gap:d list-radius:r trigger-gap:d trigger-height-touch:d trigger-font-size:t trigger-font-weight:t disabled-opacity:o',
  tag: '',
  'tags-input':
    'height:d height-touch:d gap:d padding-inline:d radius:r border-width:b elevation:e tag-radius:r tag-font-size:t disabled-opacity:o',
  timeline: 'marker-size:d marker-radius:r time-font-size:t time-font-weight:t',
  toast:
    'gap:d padding-block:d radius:r border-width:b elevation:e icon-size:d title-font-size:t title-font-weight:t',
  toggle:
    'height-sm:d height-md:d height-lg:d padding-inline-sm:d padding-inline-md:d padding-inline-lg:d gap:d radius:r border-width:b font-size:t font-weight:t line-height:t disabled-opacity:o',
  'toggle-group': '',
  toolbar:
    'gap:d padding:d radius:r border-width:b item-height-sm:d item-font-size:t item-font-weight:t disabled-opacity:o',
  tooltip: 'radius:r font-size:t font-weight:t line-height:t elevation:e',
  tree: 'gap:d padding:d radius:r row-gap:d row-padding-block:d checkbox-size:d checkbox-radius:r',
  'workflow-node': 'padding-block:d padding-inline:d radius:r elevation:e',
};

/** Component defaults: `[variants, sizes]`, space-separated; a test keeps it equal to `texuli`. */
export const DS_COMPONENT_DEFAULTS: Readonly<Record<string, readonly [string, string]>> = {
  accordion: ['default bordered', ''],
  avatar: ['', 'xs sm md lg'],
  badge: ['default secondary outline success warning destructive info neutral', ''],
  breadcrumb: ['', 'sm md lg'],
  button: ['default secondary outline ghost destructive link', 'sm md lg icon'],
  card: ['elevated flat', ''],
  chip: ['default secondary outline success warning destructive info neutral', ''],
  choice: ['', 'sm md'],
  code: ['inline block', ''],
  combobox: ['outline soft', 'sm md lg'],
  command: ['outline soft', 'sm md lg'],
  'copy-button': ['', 'sm md'],
  date: ['', 'sm md'],
  dialog: ['', 'sm md lg xl'],
  empty: ['', 'sm md'],
  'file-upload': ['default compact', ''],
  icon: ['', 'xs sm md lg'],
  'icon-button': ['default secondary outline ghost destructive link', 'sm md lg icon'],
  label: ['', 'sm md'],
  menu: ['default soft', 'sm md lg'],
  navigation: ['', 'sm md lg'],
  'number-field': ['', 'sm md lg'],
  pagination: ['outline soft', 'sm md lg'],
  'pin-input': ['', 'sm md lg'],
  popover: ['elevated flat', 'sm md lg'],
  progress: ['', 'sm md lg'],
  'radio-group': ['default card', 'sm md'],
  rating: ['', 'sm md lg'],
  resizable: ['plain bordered', ''],
  'resizable-handle': ['', 'sm md'],
  'scroll-area': ['', 'sm md lg'],
  select: ['outline soft', 'sm md lg'],
  separator: ['default subtle strong', ''],
  sheet: ['', 'sm md lg xl'],
  sidebar: ['default inset', ''],
  skeleton: ['', 'sm md lg'],
  slider: ['', 'sm md lg'],
  spinner: ['', 'sm md lg'],
  stat: ['elevated flat', ''],
  tabs: ['line pills enclosed', ''],
  tag: ['default secondary outline success warning destructive info neutral', ''],
  toggle: ['default outline', 'sm md lg'],
  'toggle-group': ['default outline', 'sm md lg'],
  toolbar: ['default outline ghost', 'sm md'],
  tree: ['default bordered', ''],
};

const components: Record<string, DsNode> = {};
for (const [id, pairs] of Object.entries(DS_COMPONENT_TOKENS)) {
  const shape: Record<string, DsNode> = {};
  for (const pair of pairs ? pairs.split(' ') : []) {
    const [key, kind] = pair.split(':') as [string, string];
    shape[key] = DS_TOKEN_KINDS[kind] as string;
  }
  const defaults = DS_COMPONENT_DEFAULTS[id];
  if (defaults) {
    const [variant, size] = defaults;
    shape.defaults = {
      ...(variant ? { variant: ['e', variant] } : {}),
      ...(size ? { size: ['e', size] } : {}),
    };
  }
  components[id] = shape;
}

const sections: Record<string, DsNode> = keys(
  'color typography shape space elevation surface motion layout icons components assets voice accessibility',
  ''
);
for (const name of Object.keys(sections)) sections[name] = name;

/** Every named definition. */
export const DS_DEFS: Readonly<Record<string, DsNode>> = {
  colorValue: ['s', P.color, 64],
  roleName: ['e', DS_ROLES],
  roleMap: keys(DS_ROLES, color),
  dataVizPalette: {
    categorical: ['l', color, 8, 8],
    sequential: ['l', color, 9, 9],
    diverging: ['l', color, 9, 9],
    grid: color,
    axis: color,
  },
  fontFile: {
    'src!': ['u', 'f', DESIGN_SYSTEM_LIMITS.font],
    weight: ['s', /^[1-9]00(?: [1-9]00)?$/, 7],
    style: ['e', 'normal italic'],
    display: ['e', 'swap fallback optional block auto'],
    preload: ['b'],
  },
  fontFamily: {
    'stack!': ['l', ['s', /^-?[A-Za-z0-9][A-Za-z0-9 _.-]{0,31}$/, 33], 1, 8],
    files: ['l', 'fontFile', 0, 8],
  },
  typeRole: {
    family: ['e', 'sans heading mono serif'],
    size: ['n', 8, 128],
    weight: ['i', 100, 900],
    line: ['n', 1, 2.5],
    tracking: ['n', -0.1, 0.2],
  },
  typeRoleName: ['e', 'display title heading body label caption code'],
  radiusStep: ['e', 'none xs sm md lg xl full'],
  spaceStep: [
    'e',
    'space-0 space-1 space-2 space-3 space-4 space-5 space-6 space-7 space-8 space-9 space-10 space-11 space-12',
  ],
  dimension: [
    'e',
    'space-0 space-1 space-2 space-3 space-4 space-5 space-6 space-7 space-8 space-9 space-10 space-11 space-12 control-xs control-sm control-md control-lg icon-xs icon-sm icon-md icon-lg target-min target-touch',
  ],
  borderStep: ['e', 'none thin thick'],
  elevationLevel: ['i', 0, 5],
  opacityStep: ['e', 'disabled muted scrim'],
  strokeWidth: ['n', 0.5, 4],
  asset: ['u', 'i', DESIGN_SYSTEM_LIMITS.logo],
  color: {
    brand: {
      'seed!': color,
      secondary: color,
      accent: color,
      neutral: ['e', 'zinc slate stone gray warm cool tinted'],
    },
    pin: keys('primary secondary accent destructive success warning info', color),
    roles: { light: 'roleMap', dark: 'roleMap' },
    modes: ['l', ['e', 'light dark'], 1, 2, 1],
    dataViz: { light: 'dataVizPalette', dark: 'dataVizPalette', cvdSafe: ['b'] },
    status: keys('success warning danger info neutral', color),
  },
  typography: {
    families: keys('sans heading mono serif', 'fontFamily'),
    scale: { base: ['n', 12, 24], ratio: ['n', 1.05, 1.618] },
    roles: keys('display title heading body label caption code', 'typeRole'),
  },
  shape: { radius: ['n', 0, 48], radiusScale: ['n', 0, 4], borderWidth: ['n', 0, 4] },
  space: { base: ['n', 2, 8], density: ['n', 0.75, 1.25] },
  elevation: { style: ['e', 'flat soft crisp glow layered'] },
  surface: { style: ['e', 'solid glass'], glass: { alpha: ['n', 0, 1], blur: ['n', 0, 64] } },
  motion: {
    personality: ['e', 'none subtle standard expressive'],
    durations: keys('fast base slow', ['i', 0, 2000]),
    easing: ['e', 'standard emphasized enter exit linear'],
  },
  layout: {
    contentMax: ['i', 320, 2560],
    wideMax: ['i', 320, 2560],
    breakpoints: keys('sm md lg', ['i', 320, 2560]),
    grid: {
      columns: keys('base sm md lg', ['i', 1, 24]),
      gutter: keys('base sm md lg', 'spaceStep'),
    },
  },
  icons: {
    style: ['e', 'outline filled'],
    stroke: ['n', 0.5, 3],
    size: keys('sm md lg', ['n', 8, 64]),
  },
  components,
  assets: {
    logo: keys('light dark mark wordmark', 'asset'),
    favicon: ['u', 'i', DESIGN_SYSTEM_LIMITS.favicon],
  },
  voice: {
    tone: ['l', ['s', /^[a-z][a-z-]{0,31}$/, 32], 0, 8, 1],
    lexicon: ['m', ['t', 64], 200, P.key],
    guidelines: ['l', ['t', 200], 0, 12],
  },
  accessibility: {
    contrast: ['e', 'AA AAA'],
    targetMin: ['i', 24, 64],
    focus: ['e', 'ring outline glow inset'],
    focusWidth: ['n', 1, 6],
    focusOffset: ['n', 0, 8],
  },
  variant: sections,
};

/** The document root. */
export const DS_ROOT: DsObject = {
  'format!': ['k', DESIGN_SYSTEM_FORMAT],
  'formatVersion!': ['k', DESIGN_SYSTEM_FORMAT_VERSION],
  'id!': ['s', P.id, 64],
  'version!': ['s', P.semver, 64],
  'name!': ['t', 80],
  description: ['t', 500],
  owner: ['t', 80],
  license: ['t', 80],
  tags: ['l', ['s', /^[a-z0-9][a-z0-9-]{0,31}$/, 32], 0, 16, 1],
  extends: ['x'],
  ...sections,
  variants: ['m', 'variant', 16, P.key],
};
