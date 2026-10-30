// @vitest-environment node
/**
 * Token contract v2 (ADR-020, T-tokens-v2): the system families, the
 * component registry, the generated surfaces (base.css block, renames.json,
 * docs/tokens-components.md), the schema and Tailwind wiring, data-viz, and
 * the guard that no new name is already read anywhere (so defining it in
 * base.css cannot change rendering).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  renderRenamesJson,
  renderTokenDefaultsBlock,
  renderTokenTablesDoc,
} from '../scripts/render.ts';
import {
  COMPONENT_IDS,
  COMPONENT_TOKEN_FAMILIES,
  COMPONENT_TOKENS,
  findComponentToken,
  getComponentTokens,
  getComponentTokensJsonSchema,
  isComponentTokenName,
} from '../src/components/index.ts';
import { semanticTokenToCssVar } from '../src/contract/prefix.ts';
import { THEME_JSON_SCHEMA } from '../src/contract/schema.ts';
import { INTERACTION_STATES, SEMANTIC_ROLES } from '../src/contract/semantic.ts';
import { themeVariables } from '../src/css/apply.ts';
import { chartPaletteInputFor, dataVizVariables, themeChartTokens } from '../src/data-viz/index.ts';
import { loadAllFullLibraryThemes } from '../src/library-expand/index.ts';
import { loadLibraryTheme } from '../src/library-port/index.ts';
import { TOKEN_RENAMES, TOKEN_RENAMES_JSON_SCHEMA } from '../src/renames/index.ts';
import {
  BASE_SYSTEM_TOKEN_NAMES,
  DATA_VIZ_TOKEN_NAMES,
  isSystemTokenName,
  SYSTEM_TOKEN_FAMILIES,
  SYSTEM_TOKEN_NAMES,
  SYSTEM_TOKENS,
  TOKEN_SCOPE_SELECTOR,
} from '../src/system/index.ts';
import { TAILWIND_THEME_ENTRIES, themeEntryValue } from '../src/tailwind/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const TOKENS = join(ROOT, 'packages/tokens');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

// ── a tiny CSS value resolver: var() substitution plus calc/min/max on lengths ──

type Num = { n: number; unit: '' | 'px' | 'em' | '%' | 'ch' };

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim());
}

/** Substitute every var() against `vars` (a missing name takes its fallback). */
function substitute(value: string, vars: Record<string, string>, depth = 0): string {
  if (depth > 30) throw new Error(`var() cycle in ${value}`);
  const at = value.indexOf('var(');
  if (at < 0) return value;
  let level = 0;
  let end = at + 3;
  for (; end < value.length; end += 1) {
    if (value[end] === '(') level += 1;
    else if (value[end] === ')') {
      level -= 1;
      if (level === 0) break;
    }
  }
  const [name, ...rest] = splitTopLevel(value.slice(at + 4, end));
  const fallback = rest.length > 0 ? rest.join(', ') : undefined;
  const own = name !== undefined ? vars[name] : undefined;
  let replacement: string;
  if (own !== undefined) replacement = substitute(own, vars, depth + 1);
  else if (fallback !== undefined) replacement = substitute(fallback, vars, depth + 1);
  else throw new Error(`unresolved ${name}`);
  return substitute(value.slice(0, at) + replacement + value.slice(end + 1), vars, depth);
}

function evaluate(expression: string): Num | null {
  const tokens = expression.match(/-?\d*\.?\d+(?:px|rem|em|%|ch)?|[a-z]+\(|[()+\-*/,]/g);
  if (!tokens || tokens.join('').replace(/\s/g, '') !== expression.replace(/\s/g, '')) return null;
  let i = 0;
  const atom = (): Num => {
    const token = tokens[i++] as string;
    if (token === '(' || token === 'calc(') {
      const value = sum();
      i += 1; // ')'
      return value;
    }
    if (token === 'max(' || token === 'min(') {
      const args = [sum()];
      while (tokens[i] === ',') {
        i += 1;
        args.push(sum());
      }
      i += 1;
      const unit = args[0]?.unit ?? '';
      if (args.some((arg) => arg.unit !== unit)) throw new Error('mixed units');
      const pick = token === 'max(' ? Math.max : Math.min;
      return { n: pick(...args.map((arg) => arg.n)), unit };
    }
    const match = /^(-?\d*\.?\d+)(px|rem|em|%|ch)?$/.exec(token);
    if (!match) throw new Error(`bad token ${token}`);
    const n = Number(match[1]);
    if (match[2] === 'rem') return { n: n * 16, unit: 'px' };
    return { n, unit: (match[2] ?? '') as Num['unit'] };
  };
  const product = (): Num => {
    let left = atom();
    while (tokens[i] === '*' || tokens[i] === '/') {
      const op = tokens[i++];
      const right = atom();
      const unit = left.unit || right.unit;
      left = { n: op === '*' ? left.n * right.n : left.n / right.n, unit };
    }
    return left;
  };
  const sum = (): Num => {
    let left = product();
    while (tokens[i] === '+' || tokens[i] === '-') {
      const op = tokens[i++];
      const right = product();
      if (left.unit !== right.unit && left.n !== 0 && right.n !== 0) throw new Error('mixed units');
      const unit = left.unit || right.unit;
      left = { n: op === '+' ? left.n + right.n : left.n - right.n, unit };
    }
    return left;
  };
  try {
    const value = sum();
    return i === tokens.length ? value : null;
  } catch {
    return null;
  }
}

/** A comparable form: `12px` for lengths, the normalized string otherwise. */
function computed(value: string, vars: Record<string, string>): string {
  const text = substitute(value, vars).replace(/\s+/g, ' ').trim();
  const num = evaluate(text);
  return num ? `${Number(num.n.toFixed(4))}${num.unit}` : text;
}

const normalizeSource = (text: string) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+,/g, ',');

// ── today's rendered values, measured from the component stylesheets ──

const css = (dir: string, file = dir) => `packages/texuli/src/components/${dir}/${file}.css`;
const SM = 'var(--tx-font-size-sm, 0.875rem)';
const XS = 'var(--tx-font-size-xs, 0.75rem)';
const XS13 = 'var(--tx-font-size-xs, 0.8125rem)';
const BASE = 'var(--tx-font-size-base, 1rem)';
const LG = 'var(--tx-font-size-lg, 1.125rem)';
const MEDIUM = 'var(--tx-font-weight-medium, 500)';
const HEADING = 'var(--tx-font-weight-heading, 600)';
const FULL = 'var(--tx-radius-full, 9999px)';
const BW = 'var(--tx-border-width, 1px)';
const SOFT = 'var(--tx-shadow-soft, none)';
const SOFT8 = 'var(--tx-shadow-soft, 0 1px 2px color-mix(in srgb, CanvasText 8%, transparent))';
const FLOAT14 =
  'var(--tx-shadow-float, 0 8px 24px color-mix(in srgb, CanvasText 14%, transparent))';
const FLOAT18 =
  'var(--tx-shadow-float, 0 12px 40px color-mix(in srgb, CanvasText 18%, transparent))';

/**
 * component → [stylesheet, { key: the value the component renders today }].
 * A `null` stylesheet means the value lives outside CSS (Icon attributes).
 */
const TODAY: Record<string, [string | null, Record<string, string>]> = {
  alert: [
    css('alert'),
    {
      radius: 'var(--tx-radius, 0.5rem)',
      'border-width': BW,
      'padding-block': '0.75rem',
      'padding-inline': '0.875rem',
      gap: '0.5rem',
      'font-size': SM,
      'icon-size': '1.25rem',
    },
  ],
  avatar: [
    css('avatar'),
    {
      'size-xs': '1.25rem',
      'size-sm': '1.75rem',
      'size-md': '2.25rem',
      'size-lg': '3rem',
      radius: FULL,
      'font-weight': 'var(--tx-font-weight-semibold, 600)',
    },
  ],
  badge: [
    css('badge'),
    {
      radius: FULL,
      'padding-block': '0.125rem',
      'padding-inline': '0.5rem',
      gap: '0.25rem',
      'font-size': XS,
      'font-weight': MEDIUM,
      'line-height': '1.25',
      'border-width': '1px',
    },
  ],
  button: [
    css('button'),
    {
      'height-sm': '2rem',
      'height-md': '2.25rem',
      'height-lg': '2.75rem',
      'height-touch': 'max(2.75rem, 44px)',
      'padding-inline-sm': '0.75rem',
      'padding-inline-md': '1rem',
      'padding-inline-lg': '1.5rem',
      gap: '0.5rem',
      radius: 'var(--tx-radius, 0.625rem)',
      'font-size': '0.875rem',
      'font-size-sm': '0.75rem',
      'font-size-lg': '1rem',
      'font-weight': '500',
      'line-height': '1.25',
      'icon-size': '1rem',
      'border-width': '1px',
      elevation: SOFT,
      'disabled-opacity': '0.5',
    },
  ],
  card: [
    css('card'),
    {
      radius: 'var(--tx-radius-xl, 0.75rem)',
      'border-width': '1px',
      elevation: SOFT8,
      'padding-inline': '1.25rem',
      'title-font-size': BASE,
      'title-font-weight': HEADING,
      'title-line-height': '1.25',
      'description-font-size': SM,
    },
  ],
  carousel: [css('carousel'), { radius: 'var(--tx-radius, 0.5rem)', 'fallback-padding': '1rem' }],
  choice: [
    css('choice'),
    {
      gap: '0.625rem',
      'switch-gap': '1rem',
      'label-font-size': SM,
      'label-font-weight': MEDIUM,
      'description-font-size': XS,
      'disabled-opacity': '0.5',
    },
  ],
  combobox: [
    css('combobox'),
    {
      'height-sm': '2rem',
      'height-md': '2.25rem',
      'height-lg': '2.75rem',
      radius: 'var(--tx-radius, 0.375rem)',
      'border-width': BW,
      'font-size-sm': XS13,
      'font-size-md': SM,
      'font-size-lg': BASE,
    },
  ],
  command: [
    css('command'),
    {
      radius: 'var(--tx-radius-lg, 0.75rem)',
      'border-width': BW,
      'font-size-sm': XS13,
      'font-size-md': SM,
      'font-size-lg': BASE,
      'input-gap': '0.75rem',
      'input-padding-inline': '1rem',
    },
  ],
  date: [
    css('date'),
    {
      'font-size': SM,
      'label-font-weight': MEDIUM,
      'control-radius': 'var(--tx-radius, 0.5rem)',
      'control-border-width': BW,
      'panel-z-index': '50',
      'panel-padding': '0.75rem',
      'panel-radius': 'var(--tx-radius-lg, 0.75rem)',
      'panel-elevation': FLOAT14,
      'description-font-size': XS,
    },
  ],
  dialog: [
    css('dialog'),
    {
      'z-index': '60',
      radius: 'var(--tx-radius-xl, 0.75rem)',
      'border-width': '1px',
      elevation: FLOAT18,
      'font-size': SM,
      'line-height': '1.5',
      'title-font-size': LG,
      'title-font-weight': 'var(--tx-font-weight-heading, 650)',
      'title-line-height': '1.3',
      'alert-padding': '1.25rem',
      'scrim-opacity': '45%',
    },
  ],
  empty: [
    css('empty'),
    {
      gap: '0.75rem',
      'padding-inline': '1.5rem',
      'padding-block': '3.5rem',
      'title-font-size': BASE,
      'title-font-weight': HEADING,
      'description-font-size': SM,
    },
  ],
  field: [
    css('field'),
    {
      gap: '0.375rem',
      'label-font-size': SM,
      'label-font-weight': MEDIUM,
      'label-line-height': '1.25',
      'description-font-size': XS,
      'description-line-height': '1.35',
    },
  ],
  'file-upload': [
    css('file-upload'),
    {
      gap: '0.75rem',
      'zone-padding-block': '1.5rem',
      'zone-padding-inline': '1rem',
      'zone-border-width': '2px',
      'zone-radius': 'var(--tx-radius, 0.625rem)',
      'browse-height': '2.25rem',
    },
  ],
  // Icon sizes are SVG attributes (icon-variants.ts: 12, 16, 20, 24 px; stroke 2).
  icon: [
    null,
    {
      'size-xs': '12px',
      'size-sm': '16px',
      'size-md': '20px',
      'size-lg': '24px',
      'stroke-width': '2',
    },
  ],
  input: [
    css('input', 'field'),
    {
      height: '2.25rem',
      'height-touch': '2.75rem',
      'padding-block': '0.25rem',
      'padding-inline': '0.75rem',
      radius: 'var(--tx-radius, 0.375rem)',
      'border-width': BW,
      elevation: SOFT,
      'font-size': SM,
      'font-size-touch': BASE,
      'font-weight': 'var(--tx-font-weight-body, 400)',
      'textarea-padding-block': '0.5rem',
      'disabled-opacity': '0.5',
    },
  ],
  kbd: [
    css('kbd-code'),
    {
      'min-size': '1.25rem',
      'padding-block': '0.125rem',
      radius: 'calc(var(--tx-radius, 0.625rem) * 0.4)',
      'border-width': '1px',
      'font-weight': '500',
    },
  ],
  code: [
    css('kbd-code'),
    {
      'font-size': '0.875em',
      'font-weight': '400',
      'block-padding-block': '0.75rem',
      'block-padding-inline': '1rem',
      'block-radius': 'var(--tx-radius, 0.625rem)',
      'block-line-height': '1.5',
      'block-border-width': '1px',
    },
  ],
  menu: [
    css('menus'),
    {
      'trigger-height-sm': '2rem',
      'trigger-height-md': '2.25rem',
      'trigger-height-lg': '2.75rem',
      'trigger-radius': 'var(--tx-radius, 0.375rem)',
      'trigger-border-width': '1px',
      'trigger-font-size': SM,
      'trigger-font-weight': '500',
      'content-z-index': '50',
      'content-padding-block': '0.25rem',
      'content-radius': 'var(--tx-radius-lg, 0.5rem)',
      'content-elevation': FLOAT14,
      'content-font-size': SM,
    },
  ],
  navigation: [
    css('navigation'),
    {
      'z-index': '40',
      'font-size': SM,
      'list-gap': '0.25rem',
      'trigger-radius': 'var(--tx-radius-md, 0.375rem)',
      'chevron-opacity': '0.7',
    },
  ],
  'number-field': [
    css('number-pin'),
    {
      radius: 'var(--tx-radius-md, 0.5rem)',
      'border-width': '1px',
      'padding-block': '0.5rem',
      'padding-inline': '0.75rem',
      'stepper-size': '2.25rem',
    },
  ],
  'pin-input': [
    css('number-pin'),
    {
      gap: '0.5rem',
      'cell-inline-size': '2.75rem',
      'cell-block-size': '3rem',
      'cell-radius': 'var(--tx-radius-md, 0.5rem)',
      'cell-font-size': LG,
    },
  ],
  popover: [
    css('popover'),
    {
      'z-index': '50',
      'padding-block': '0.75rem',
      'padding-inline': '0.875rem',
      radius: 'var(--tx-radius-lg, 0.5rem)',
      'border-width': '1px',
      elevation: FLOAT14,
      'font-size': SM,
      'title-font-size': BASE,
      'title-font-weight': HEADING,
      'title-line-height': '1.3',
    },
  ],
  progress: [
    css('feedback'),
    {
      gap: '0.375rem',
      'font-size': SM,
      radius: FULL,
      'track-height-sm': '0.375rem',
      'track-height-md': '0.625rem',
      'track-height-lg': '0.875rem',
    },
  ],
  rating: [
    css('rating'),
    {
      'stars-gap': '0.125rem',
      'label-font-size': SM,
      'label-font-weight': MEDIUM,
      'star-radius': 'var(--tx-radius, 0.375rem)',
    },
  ],
  resizable: [css('resizable'), { radius: 'var(--tx-radius-lg, 0.75rem)', 'border-width': BW }],
  'scroll-area': [
    css('scroll-area'),
    {
      radius: 'var(--tx-radius-md, 0.5rem)',
      'border-width': '1px',
      padding: '0.75rem',
      'scrollbar-size': '0.625rem',
      'scrollbar-radius': FULL,
      'thumb-min-size': '1rem',
    },
  ],
  select: [
    css('select'),
    {
      'height-sm': '2rem',
      'height-md': '2.25rem',
      'height-lg': '2.75rem',
      'padding-inline-sm': '0.5rem',
      'padding-inline-md': '0.75rem',
      'padding-inline-lg': '0.875rem',
      gap: '0.5rem',
      radius: 'var(--tx-radius, 0.375rem)',
      'border-width': BW,
      'font-size-sm': XS13,
      'font-size-md': SM,
      'font-size-lg': BASE,
      'font-weight': 'var(--tx-font-weight-body, 400)',
      'chevron-size': '1rem',
      'chevron-opacity': '0.7',
    },
  ],
  separator: [css('separator-aspect'), { thickness: '1px' }],
  'aspect-ratio': [css('separator-aspect'), { radius: 'var(--tx-radius, 0.5rem)' }],
  sheet: [
    css('sheet'),
    {
      'z-index': 'var(--tx-overlay-z, 60)',
      gap: '1rem',
      padding: '1.25rem',
      'border-width': '1px',
      elevation: FLOAT18,
      'font-size': SM,
      'line-height': '1.5',
      'title-font-size': LG,
      'title-font-weight': 'var(--tx-font-weight-heading, 650)',
      'title-line-height': '1.3',
      'scrim-opacity': '45%',
    },
  ],
  sidebar: [
    css('sidebar'),
    {
      'font-size': SM,
      'inset-radius': 'var(--tx-radius-lg, 0.5rem)',
      'header-padding-inline': '0.75rem',
      'header-gap': '0.5rem',
      'body-gap': '1rem',
      'body-padding-block': '0.75rem',
      'body-padding-inline': '0.5rem',
    },
  ],
  skeleton: [
    css('feedback'),
    {
      radius: 'var(--tx-radius-md, 0.375rem)',
      'height-sm': '0.75rem',
      'height-md': '1rem',
      'height-lg': '1.5rem',
      'circle-size': '2.5rem',
    },
  ],
  slider: [
    css('slider'),
    {
      'thumb-border-width': '2px',
      'thumb-elevation':
        'var(--tx-shadow-soft, 0 1px 2px color-mix(in srgb, CanvasText 15%, transparent))',
      'disabled-opacity': '0.5',
    },
  ],
  spinner: [css('feedback'), { radius: '9999px' }],
  stat: [
    css('stat'),
    {
      gap: '0.5rem',
      padding: '1.25rem',
      radius: 'var(--tx-radius-xl, 0.75rem)',
      'border-width': '1px',
      elevation: SOFT8,
      'label-font-size': SM,
      'label-font-weight': MEDIUM,
      'value-font-size': 'var(--tx-font-size-2xl, 1.5rem)',
      'value-font-weight': HEADING,
      'icon-size': '2rem',
      'icon-radius': 'var(--tx-radius-md, 0.375rem)',
    },
  ],
  stepper: [
    css('stepper'),
    {
      gap: '0.75rem',
      'trigger-radius': 'var(--tx-radius-md, 0.375rem)',
      'marker-size': '2rem',
      'marker-radius': FULL,
      'marker-border-width': '1px',
      'marker-font-size': XS,
      'marker-font-weight': 'var(--tx-font-weight-semibold, 600)',
      'check-size': '1rem',
    },
  ],
  table: [
    css('table'),
    {
      radius: 'var(--tx-radius-xl, 0.75rem)',
      'border-width': BW,
      'font-size': SM,
      'head-font-size': XS,
      'head-font-weight': MEDIUM,
    },
  ],
  tabs: [
    css('tabs-accordion'),
    {
      gap: '0.75rem',
      'list-gap': '0.25rem',
      'list-radius': 'var(--tx-radius-lg, 0.5rem)',
      'trigger-gap': '0.5rem',
      'trigger-height-touch': '2.75rem',
      'trigger-font-size': SM,
      'trigger-font-weight': MEDIUM,
      'disabled-opacity': '0.5',
    },
  ],
  accordion: [
    css('tabs-accordion'),
    {
      'trigger-gap': '1rem',
      'trigger-padding-block': '0.75rem',
      'trigger-font-size': SM,
      'trigger-font-weight': MEDIUM,
      'disabled-opacity': '0.5',
    },
  ],
  'tags-input': [
    css('tags-color'),
    {
      height: '2.25rem',
      'height-touch': '2.75rem',
      gap: '0.375rem',
      'padding-inline': '0.5rem',
      radius: 'var(--tx-radius, 0.375rem)',
      'border-width': BW,
      elevation: SOFT,
      'tag-radius': FULL,
      'tag-font-size': SM,
      'disabled-opacity': '0.5',
    },
  ],
  'color-picker': [
    css('tags-color'),
    { gap: '0.75rem', 'swatch-size': '1.5rem', 'swatch-radius': 'var(--tx-radius-sm, 0.25rem)' },
  ],
  timeline: [
    css('timeline'),
    {
      'marker-size': '1rem',
      'marker-radius': FULL,
      'time-font-size': XS,
      'time-font-weight': MEDIUM,
    },
  ],
  toast: [
    css('toast'),
    {
      'z-index': '60',
      gap: '0.75rem',
      'padding-block': '0.75rem',
      radius: 'var(--tx-radius-lg, 0.5rem)',
      'border-width': '1px',
      elevation: 'var(--tx-shadow-float, 0 10px 30px -8px var(--tx-shadow, rgb(0 0 0 / 0.25)))',
      'icon-size': '1.25rem',
      'title-font-size': SM,
      'title-font-weight': MEDIUM,
    },
  ],
  toggle: [
    css('toggle'),
    {
      'height-sm': '2rem',
      'height-md': '2.25rem',
      'height-lg': '2.75rem',
      'padding-inline-sm': '0.5rem',
      'padding-inline-md': '0.75rem',
      'padding-inline-lg': '1rem',
      gap: '0.375rem',
      radius: 'var(--tx-radius, 0.5rem)',
      'border-width': '1px',
      'font-size': '0.875rem',
      'font-weight': '500',
      'line-height': '1.25',
      'disabled-opacity': '0.5',
    },
  ],
  toolbar: [
    css('toolbar'),
    {
      gap: '0.25rem',
      padding: '0.25rem',
      radius: 'var(--tx-radius, 0.5rem)',
      'border-width': '1px',
      'item-height-sm': '1.75rem',
      'item-font-size': '0.875rem',
      'item-font-weight': '500',
      'disabled-opacity': '0.5',
    },
  ],
  tooltip: [
    css('tooltip'),
    {
      'z-index': '50',
      radius: 'calc(var(--tx-radius, 0.625rem) * 0.55)',
      'font-size': '0.75rem',
      'font-weight': '500',
      'line-height': '1.35',
      elevation:
        'var(--tx-shadow-float, 0 8px 24px color-mix(in srgb, CanvasText 18%, transparent))',
    },
  ],
  tree: [
    css('tree'),
    {
      gap: '0.125rem',
      padding: '0.25rem',
      radius: 'var(--tx-radius-md, 0.5rem)',
      'row-gap': '0.5rem',
      'row-padding-block': '0.25rem',
      'checkbox-size': '1rem',
      'checkbox-radius': 'var(--tx-radius-xs, 0.125rem)',
    },
  ],
};

/** Every variable in scope at a `[data-tx-theme]` element for one theme and mode. */
async function scopeVariables(mode: 'light' | 'dark'): Promise<Record<string, string>> {
  const theme = await loadLibraryTheme('enterprise-neutral');
  return {
    ...themeVariables({ theme, mode }),
    ...Object.fromEntries(
      SYSTEM_TOKEN_FAMILIES.filter((f) => f.emit === 'base').flatMap((f) =>
        f.tokens.map((t) => [t.name, t.value])
      )
    ),
    ...Object.fromEntries(COMPONENT_TOKENS.map((t) => [t.token, t.default])),
  };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(css|svelte|ts|js|astro)$/.test(name)) out.push(path);
  }
  return out;
}

describe('token contract v2: system families', () => {
  it('lists every family with unique --tx-* names that match the compact name list', () => {
    expect(SYSTEM_TOKEN_FAMILIES.map((f) => f.id)).toEqual([
      'space',
      'size',
      'type',
      'elevation',
      'shape',
      'layer',
      'opacity',
      'layout',
      'icon',
      'status',
      'data-viz',
    ]);
    const counts = Object.fromEntries(SYSTEM_TOKEN_FAMILIES.map((f) => [f.id, f.tokens.length]));
    expect(counts).toEqual({
      space: 14,
      size: 10,
      type: 35,
      elevation: 8,
      shape: 9,
      layer: 8,
      opacity: 3,
      layout: 14,
      icon: 2,
      status: 20,
      'data-viz': 28,
    });
    const names = SYSTEM_TOKENS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^--tx-[a-z0-9-]+$/);
    for (const token of SYSTEM_TOKENS) expect(token.description.length).toBeGreaterThan(3);
    expect(names).toEqual([...SYSTEM_TOKEN_NAMES]);
    const base = SYSTEM_TOKEN_FAMILIES.filter((f) => f.emit === 'base').flatMap((f) => f.tokens);
    expect(base.map((t) => t.name)).toEqual([...BASE_SYSTEM_TOKEN_NAMES]);
    expect(
      SYSTEM_TOKEN_FAMILIES.find((f) => f.id === 'data-viz')?.tokens.map((t) => t.name)
    ).toEqual([...DATA_VIZ_TOKEN_NAMES]);
    expect(isSystemTokenName('--tx-space-4')).toBe(true);
    expect(isSystemTokenName('--tx-radius-md')).toBe(false);
  });

  it('defaults reproduce the values the components render today', async () => {
    const vars = await scopeVariables('light');
    // [system token, today's literal or theme value, where it is measured]
    const measured: [string, string][] = [
      ['--tx-space-0', '0px'],
      ['--tx-space-1', '0.25rem'], // gaps and paddings on the 0.25rem step
      ['--tx-space-2', '0.5rem'],
      ['--tx-space-3', '0.75rem'],
      ['--tx-space-4', '1rem'],
      ['--tx-space-12', '3rem'],
      ['--tx-size-control-xs', '1.75rem'], // toolbar.css small items
      ['--tx-size-control-sm', '2rem'], // button.css .tx-button--sm
      ['--tx-size-control-md', '2.25rem'], // button.css .tx-button--md
      ['--tx-size-control-lg', '2.75rem'], // button.css .tx-button--lg
      ['--tx-size-icon-xs', '12px'], // icon-variants.ts
      ['--tx-size-icon-sm', '16px'],
      ['--tx-size-icon-md', '20px'],
      ['--tx-size-icon-lg', '24px'],
      ['--tx-size-target-touch', '44px'], // button.css max(2.75rem, 44px)
      ['--tx-size-target-min', '24px'], // densityTargetSize floor
      ['--tx-type-label-size', '0.875rem'], // button.css font-size
      ['--tx-type-label-weight', '500'],
      ['--tx-type-label-line', '1.25'],
      ['--tx-type-heading-size', '1.125rem'], // dialog and sheet titles
      ['--tx-type-heading-line', '1.3'],
      ['--tx-type-body-size', '1rem'], // base.css body
      ['--tx-type-caption-size', '0.75rem'],
      ['--tx-type-title-size', '1.5rem'], // stat value
      ['--tx-shape-radius-lg', '0.5rem'], // the theme radius
      ['--tx-shape-radius-xl', '0.75rem'], // card, dialog fallbacks
      ['--tx-shape-radius-md', '0.375rem'], // skeleton fallback
      ['--tx-shape-radius-sm', '0.25rem'], // color swatch fallback
      ['--tx-shape-radius-xs', '0.125rem'], // tree checkbox fallback
      ['--tx-border-width-thin', '1px'],
      ['--tx-border-width-thick', '2px'], // file-upload zone, slider thumb
      ['--tx-z-sticky', '40'], // navigation.css
      ['--tx-z-popover', '50'], // popover, menus, select, combobox, date
      ['--tx-z-tooltip', '50'],
      ['--tx-z-modal', '60'], // dialog.css
      ['--tx-z-overlay', '60'], // sheet.css --tx-overlay-z fallback
      ['--tx-z-toast', '60'], // toast.css
      ['--tx-z-top', '70'], // shells.css skip link
      ['--tx-opacity-disabled', '0.5'],
      ['--tx-opacity-muted', '0.7'], // select and nav chevrons
      ['--tx-opacity-scrim', '45%'], // dialog and sheet scrim mix
      ['--tx-layout-content-max', '72ch'], // content.css
      ['--tx-layout-wide-max', '80rem'], // marketing.css
      ['--tx-layout-breakpoint-sm', '36rem'], // dashboard.css container queries
      ['--tx-layout-breakpoint-md', '56rem'],
      ['--tx-layout-breakpoint-lg', '72rem'],
      ['--tx-layout-grid-columns-lg', '4'],
      ['--tx-layout-grid-gutter-md', '1rem'], // dashboard grid gap
      ['--tx-icon-stroke', '2'], // Icon strokeWidth default
      ['--tx-elevation-1', vars['--tx-shadow-soft'] as string],
      ['--tx-elevation-3', vars['--tx-shadow-float'] as string],
      ['--tx-surface-glass-alpha', '82%'],
      ['--tx-surface-glass-blur', '16px'],
      ['--tx-status-danger', vars['--tx-destructive'] as string],
      ['--tx-status-success-soft-foreground', vars['--tx-success-soft-foreground'] as string],
    ];
    for (const [name, today] of measured) {
      expect(computed(`var(${name})`, vars), name).toBe(computed(today, vars));
    }
    // The space scale follows density.
    const dense = { ...vars, '--tx-density': '0.875' };
    expect(computed('var(--tx-space-4)', dense)).toBe('14px');
  });
});

describe('token contract v2: component registry', () => {
  it('covers every styled texuli family with unique, well-formed tokens', () => {
    const exports = Object.keys(
      JSON.parse(read('packages/texuli/package.json')).exports as Record<string, unknown>
    )
      .map((key) => key.slice(2))
      .filter((key) => key && !['cx', 'motion', 'icons/lucide'].includes(key))
      .filter((key) => !key.startsWith('layouts'));
    const subpaths = new Set(COMPONENT_TOKEN_FAMILIES.map((f) => f.subpath));
    expect(exports.length).toBe(41);
    expect(exports.filter((key) => !subpaths.has(key))).toEqual([]);
    expect([...subpaths].filter((key) => !exports.includes(key))).toEqual([]);

    const names = COMPONENT_TOKENS.map((t) => t.token);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(COMPONENT_IDS).size).toBe(COMPONENT_IDS.length);
    for (const token of COMPONENT_TOKENS) {
      expect(token.token).toBe(`--tx-${token.component}-${token.key}`);
      expect(token.key).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(token.description.length).toBeGreaterThan(3);
      expect(isSystemTokenName(token.token), token.token).toBe(false);
    }
    expect(getComponentTokens('button').length).toBe(18);
    expect(getComponentTokens('nope')).toEqual([]);
    expect(findComponentToken('button', 'radius')?.default).toBe('var(--tx-shape-radius-lg)');
    expect(isComponentTokenName('--tx-card-radius')).toBe(true);
    expect(isComponentTokenName('--tx-card-foreground')).toBe(false);
  });

  it('defaults reference only system or theme tokens, never literal values', async () => {
    const themeNames = new Set(Object.keys(await scopeVariables('light')));
    const roleNames = new Set(
      SEMANTIC_ROLES.flatMap((role) =>
        INTERACTION_STATES.map((s) => semanticTokenToCssVar(role, s))
      )
    );
    for (const token of COMPONENT_TOKENS) {
      const refs = [...token.default.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1] as string);
      expect(refs.length, token.token).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(
          isSystemTokenName(ref) || roleNames.has(ref) || themeNames.has(ref),
          `${token.token} → ${ref}`
        ).toBe(true);
        expect(isComponentTokenName(ref), `${token.token} chains ${ref}`).toBe(false);
      }
      const literal = token.default.replace(/var\([^)]*\)/g, '').replace(/calc\(|\)|\*|\s/g, '');
      expect(literal, token.token).toMatch(/^[0-9.]*$/);
    }
  });

  it('every component default equals what the component renders today (visual-baseline theme)', async () => {
    expect(Object.keys(TODAY).sort()).toEqual([...COMPONENT_IDS].sort());
    for (const mode of ['light', 'dark'] as const) {
      const vars = await scopeVariables(mode);
      for (const family of COMPONENT_TOKEN_FAMILIES) {
        const [file, values] = TODAY[family.component] as [string | null, Record<string, string>];
        expect(Object.keys(values).sort(), family.component).toEqual(
          family.tokens.map((t) => t.key).sort()
        );
        const source = file ? normalizeSource(read(file)) : '';
        for (const token of family.tokens) {
          const today = values[token.key] as string;
          if (file)
            expect(source, `${token.token}: ${today} in ${file}`).toContain(normalizeSource(today));
          expect(computed(`var(${token.token})`, vars), `${token.token} (${mode})`).toBe(
            computed(today, vars)
          );
        }
      }
    }
  });

  it('publishes a closed JSON Schema of the component vocabulary', () => {
    const schema = getComponentTokensJsonSchema() as {
      additionalProperties: boolean;
      properties: Record<
        string,
        { additionalProperties: boolean; properties: Record<string, unknown> }
      >;
    };
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties)).toEqual([...COMPONENT_IDS]);
    for (const family of COMPONENT_TOKEN_FAMILIES) {
      const entry = schema.properties[family.component];
      expect(entry?.additionalProperties).toBe(false);
      expect(Object.keys(entry?.properties ?? {})).toEqual(family.tokens.map((t) => t.key));
    }
  });
});

describe('token contract v2: generated surfaces', () => {
  it('base.css carries the generated defaults once, scoped, inside @layer tx.base', () => {
    const baseCss = readFileSync(join(TOKENS, 'src/css/base.css'), 'utf8');
    const block = renderTokenDefaultsBlock();
    expect(baseCss).toContain(block);
    const layerStart = baseCss.indexOf('@layer tx.base {');
    expect(layerStart).toBeGreaterThan(0);
    expect(baseCss.indexOf(block)).toBeGreaterThan(layerStart);
    expect(block).toContain(`${TOKEN_SCOPE_SELECTOR} {`);
    for (const name of [...BASE_SYSTEM_TOKEN_NAMES, ...COMPONENT_TOKENS.map((t) => t.token)]) {
      expect(baseCss.split(`${name}:`).length - 1, name).toBe(1);
    }
    for (const name of DATA_VIZ_TOKEN_NAMES) expect(block).not.toContain(`${name}:`);
    // No literal color in a default.
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|oklch\(|hsl\(/i);
  });

  it('renames.json and the token tables doc match the generator', () => {
    expect(readFileSync(join(TOKENS, 'src/renames/renames.json'), 'utf8')).toBe(
      renderRenamesJson()
    );
    expect(readFileSync(join(TOKENS, 'docs/tokens-components.md'), 'utf8')).toBe(
      renderTokenTablesDoc()
    );
    const doc = renderTokenTablesDoc();
    for (const token of COMPONENT_TOKENS) expect(doc).toContain(`\`${token.token}\``);
    for (const token of SYSTEM_TOKENS) expect(doc).toContain(`\`${token.name}\``);
  });

  it('lists no renames yet, in the published rename schema shape', () => {
    expect(TOKEN_RENAMES).toEqual([]);
    expect(JSON.parse(readFileSync(join(TOKENS, 'src/renames/renames.json'), 'utf8'))).toEqual([]);
    expect(TOKEN_RENAMES_JSON_SCHEMA.type).toBe('array');
    expect(TOKEN_RENAMES_JSON_SCHEMA.items.required).toEqual(['from', 'to', 'since', 'removeIn']);
    expect(TOKEN_RENAMES_JSON_SCHEMA.items.additionalProperties).toBe(false);
    const pkg = JSON.parse(readFileSync(join(TOKENS, 'package.json'), 'utf8')) as {
      exports: Record<string, unknown>;
    };
    for (const subpath of [
      './components',
      './system',
      './data-viz',
      './renames',
      './renames.json',
    ]) {
      expect(pkg.exports[subpath], subpath).toBeTruthy();
    }
  });

  it('no new token name is read or declared anywhere else, so base.css changes no rendering', () => {
    const fresh = [...BASE_SYSTEM_TOKEN_NAMES, ...COMPONENT_TOKENS.map((t) => t.token)];
    const pattern = new RegExp(
      `(?:${fresh.map((n) => n.replace(/[-]/g, '\\-')).join('|')})(?![a-z0-9-])`,
      'g'
    );
    const dirs = [
      ...readdirSync(join(ROOT, 'packages'))
        .filter((name) => name !== 'tokens')
        .map((name) => join(ROOT, 'packages', name, 'src')),
      join(ROOT, 'apps/website/src'),
      join(ROOT, 'functions'),
    ];
    const hits: string[] = [];
    for (const dir of dirs) {
      let files: string[];
      try {
        files = walk(dir);
      } catch {
        continue;
      }
      for (const file of files) {
        for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
          hits.push(`${file.slice(ROOT.length + 1)}: ${match[0]}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

describe('token contract v2: schema, Tailwind and data-viz', () => {
  it('THEME_JSON_SCHEMA lists the system token vocabulary', () => {
    expect(THEME_JSON_SCHEMA.definitions.systemTokens.enum).toEqual([...SYSTEM_TOKEN_NAMES]);
  });

  it('the Tailwind spacing unit is --tx-space-unit, with the density fallback', () => {
    const entry = TAILWIND_THEME_ENTRIES.find((e) => e.themeVar === '--spacing');
    expect(entry?.tokenVar).toBe('--tx-space-unit');
    const value = themeEntryValue(entry as (typeof TAILWIND_THEME_ENTRIES)[number]);
    expect(value).toBe('var(--tx-space-unit, calc(0.25rem * var(--tx-density, 1)))');
    const preset = readFileSync(join(TOKENS, 'src/tailwind/preset.css'), 'utf8');
    expect(preset).toContain(`--spacing: ${value};`);
  });

  it('dataVizVariables gives every library theme a complete, valid chart set in both modes', async () => {
    const themes = await loadAllFullLibraryThemes();
    expect(themes.length).toBeGreaterThanOrEqual(200);
    const hex = /^#[0-9a-f]{6}$/i;
    for (const theme of themes) {
      for (const mode of ['light', 'dark'] as const) {
        const vars = dataVizVariables(theme, mode);
        expect(Object.keys(vars).sort(), theme.id).toEqual([...DATA_VIZ_TOKEN_NAMES].sort());
        for (const name of DATA_VIZ_TOKEN_NAMES.filter((n) => !/grid|axis/.test(n))) {
          expect(vars[name], `${theme.id} ${mode} ${name}`).toMatch(hex);
        }
      }
    }
  });

  it('a theme’s own charts win, and themeVariables output is unchanged for chart-less themes', async () => {
    const theme = await loadLibraryTheme('enterprise-neutral');
    expect(theme.charts).toBeUndefined();
    const vars = themeVariables({ theme, mode: 'light' });
    expect(vars['--tx-chart-1']).toBeUndefined();
    expect(
      Object.keys(vars).some((name) => /^--tx-(space|size|type|shape|z|status)-/.test(name))
    ).toBe(false);
    const derived = themeChartTokens(theme, 'light');
    const withCharts = {
      ...theme,
      charts: { light: derived, dark: themeChartTokens(theme, 'dark') },
    };
    const custom = {
      ...withCharts,
      charts: { ...withCharts.charts, light: { ...derived, grid: '#123456' } },
    };
    expect(themeChartTokens(custom, 'light').grid).toBe('#123456');
    expect(chartPaletteInputFor(theme, 'dark').chart1).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
