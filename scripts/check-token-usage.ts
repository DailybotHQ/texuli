/**
 * Hardcode guard of token contract v2 (ADR-020, T-adopt-domain).
 *
 * Scans the component CSS of every package (`packages/<pkg>/src/**\/*.css` and
 * the `<style>` blocks of `packages/<pkg>/src/**\/*.svelte`) and fails on:
 *
 * - `literal-color`: a hex color, a color function with literal channels
 *   (`rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`) or the
 *   `white` / `black` keywords. A literal inside the `var()` fallback of a
 *   contract token (a semantic role, a system token or a data-viz token) is
 *   fine: it only paints when no theme is loaded. A fallback of any other
 *   custom property is a literal, because it is what renders;
 * - `literal-space`, `literal-radius`, `literal-font-size`: a `px` or `rem`
 *   length in a spacing (`padding*`, `margin*`, `gap`, `row-gap`,
 *   `column-gap`), radius (`border-*radius`) or `font-size` declaration,
 *   outside a contract token's fallback (`em`, `ch`, `%` and viewport units
 *   are relative and pass);
 * - `literal-z-index`: a `z-index` above 30 that is not a token: values up
 *   to 30 order siblings inside one component, anything higher competes
 *   with the `--tx-z-*` layers;
 * - `system-color`: a CSS system color (`Canvas`, `CanvasText`, `ButtonFace`,
 *   `Mark`, `Highlight`…) that can render under a theme: outside the
 *   fallback of a contract token, and outside a `@media (forced-colors:
 *   active)` block (where system colors are the right answer). It paints the
 *   user agent palette whatever the design system says (T-ds-conformance);
 * - `unknown-token`: a `var(--tx-…)` read of a name that nothing defines: not
 *   a contract token (a theme role or a system token), not a component token
 *   of the `@texuli/tokens/components` registry, and never declared or set
 *   by package code (a CSS declaration, a `style:--tx-…` directive, a
 *   `setProperty('--tx-…')` call or a quoted name), unless its fallback reads
 *   one that is (the component-token pattern `var(--tx-<comp>-<key>,
 *   var(--tx-<role>))`, a host hook that paints the theme until set). Such a
 *   read always paints its fallback (`--tx-card`, `--tx-danger` and
 *   `--tx-color-*` did, so they painted `Canvas`, `Mark` or a hex color).
 *
 * Out of scope: sizes (`inline-size`, `block-size` and their limits),
 * positions, border and outline widths, line heights and shadow geometry,
 * which are layout geometry rather than design-system values. `@texuli/tokens`
 * (it defines the values) and `@texuli/examples` (demo content, not
 * components) are not scanned.
 *
 * Every literal that stays is listed in `ALLOWLIST` with its reason.
 *
 * Usage (repository root): pnpm exec tsx scripts/check-token-usage.ts [--json]
 * Exit 0 prints a summary; exit 1 lists every finding (and every stale
 * allowlist entry, so the list cannot rot).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { COMPONENT_TOKENS } from '../packages/tokens/src/components/registry.ts';
import { themeVariables } from '../packages/tokens/src/css/apply.ts';
import { loadLibraryTheme } from '../packages/tokens/src/library-port/index.ts';
import { SYSTEM_TOKEN_NAMES } from '../packages/tokens/src/system/names.ts';

export type TokenUsageCode =
  | 'literal-color'
  | 'literal-space'
  | 'literal-radius'
  | 'literal-font-size'
  | 'literal-z-index'
  | 'system-color'
  | 'unknown-token';

export interface TokenUsageFinding {
  file: string;
  line: number;
  code: TokenUsageCode;
  /** The literal that was found (`#fff`, `0.8125rem`, `100`). */
  literal: string;
  property: string;
}

/** One kept literal: where, which values, and why no token fits. */
export interface AllowlistEntry {
  /** A file path, or a directory prefix ending in `/`. */
  readonly path: string;
  /**
   * The literals kept (compared case-insensitively after whitespace collapse);
   * `*px` keeps every px length in the path (a fixed coordinate space).
   */
  readonly literals: readonly string[];
  /** Limit the entry to one rule (`literal-color`); every rule when omitted. */
  readonly code?: TokenUsageCode;
  readonly reason: string;
}

const OFF_SCALE_TYPE =
  'Off-scale type for dense data, map, timeline and chrome labels (13px, 15px, 11px…): each sits between two type-role steps, and no role reproduces it without moving pixels.';
const PENDING =
  'Pending adoption outside T-adopt-domain: the literals this package kept after T-adopt-core (off-step spaces and type, layout radii). Converting them belongs to the package owner lane and must keep pnpm visual unchanged; remove entries as they are adopted (the stale check fails on leftovers).';
const DECK_SCOPE =
  'Renders inside the deck stage, which applies the deck theme (graphite: radius 0.25rem, density 0.95) on its own scope: system and shape tokens there follow the deck theme and move the pixels of the visual baselines, so these rules keep their literals (and exact legacy reads only) until the lead decides whether components in a deck follow the deck theme.';

const LEGACY_NAME =
  'A pre-v2 size, type or shadow name that no theme or base.css defines (packages/tokens/docs/tokens-components.md, Naming: the --tx-radius-* reads carry fallbacks that disagree, so defining the names would change rendering); the read paints its fallback, which is the value the component means today. Not a color, so no design-system color is lost; moving each read to the shape, type or elevation family changes pixels and belongs to the package owner lane (remove the entry when it lands).';
const HOST_HOOK =
  'A documented host hook: the component reads it so a host can set it on an element, and the fallback is the default size or value (not a theme color). It is not a component token of the registry because a design system does not set it.';

/** Every literal the packages keep, with the reason (ADR-020: allowlist with reasons). */
export const ALLOWLIST: readonly AllowlistEntry[] = [
  // Patterns shared by every package.
  {
    path: 'packages/',
    literals: ['-1px'],
    code: 'literal-space',
    reason:
      'The visually-hidden pattern (1px box, -1px margin, clip): fixed accessibility geometry, not a space.',
  },
  {
    path: 'packages/',
    literals: [
      '0.8125rem',
      '13px',
      '11px',
      '10px',
      '0.9375rem',
      '0.95rem',
      '1.05rem',
      '1.1rem',
      '0.9rem',
      '0.85rem',
      '0.8rem',
      '0.78rem',
      '0.72rem',
      '0.7rem',
      '0.68rem',
      '0.6875rem',
      '0.65rem',
      '0.62rem',
      '1.375rem',
    ],
    code: 'literal-font-size',
    reason: OFF_SCALE_TYPE,
  },
  {
    path: 'packages/',
    literals: ['1.2rem', '1.4rem', '1.75rem'],
    code: 'literal-font-size',
    reason:
      'Document heading scale of the editor and page reader (h3, h2, h1 at a 1.2 ratio from the body): content typography, not a UI type role.',
  },
  // Real colors with a job no theme role can do.
  {
    path: 'packages/media/src/gallery/Lightbox.svelte',
    literals: [
      '#fff',
      '#000',
      'rgb(0 0 0 / 0.88)',
      'rgb(0 0 0 / 0.55)',
      'rgb(255 255 255 / 0.35)',
      'rgb(255 255 255 / 0.18)',
      'rgb(255 255 255 / 0.6)',
    ],
    code: 'literal-color',
    reason:
      'Lightbox chrome over arbitrary photos: a near-black scrim with white controls and a black halo stays legible on any image, whatever the theme (the photo, not the theme, sets the backdrop).',
  },
  {
    path: 'packages/media/src/gallery/Gallery.svelte',
    literals: ['#fff', 'rgb(0 0 0 / 0.78)'],
    code: 'literal-color',
    reason:
      'Caption over the photo: a dark scrim with white text reads on any image, independent of the theme.',
  },
  {
    path: 'packages/media/src/image-editor/Editor.svelte',
    literals: ['#ffffff', '#000000', 'rgb(0 0 0 / 0.001)'],
    code: 'literal-color',
    reason:
      'Crop edge and handle pair over the image (white line, black contrast ring) visible on any pixel, restyled by hosts through --tx-image-editor-edge and --tx-image-editor-edge-contrast; the near-transparent fill keeps the crop box hit-testable.',
  },
  {
    path: 'packages/texuli/src/components/tags-color/tags-color.css',
    literals: [
      '#000',
      '#fff',
      'oklch(0.7 0 0)',
      'oklch(0.7 0.2 var(--tx-color-picker-hue, 250))',
      'oklch(0.65 0.2 0)',
      'oklch(0.65 0.2 60)',
      'oklch(0.65 0.2 120)',
      'oklch(0.65 0.2 180)',
      'oklch(0.65 0.2 240)',
      'oklch(0.65 0.2 300)',
      'oklch(0.65 0.2 360)',
      '#3b82f6',
    ],
    code: 'literal-color',
    reason:
      'Color picker: the lightness and hue gradients are the color space being picked, not theme chrome, and #3b82f6 is the swatch shown before a value exists (the ColorPicker default; its preset swatches are data in ColorPicker.svelte, values a user picks, so they are not theme colors either).',
  },
  {
    path: 'packages/slides/src/styles.css',
    literals: ['#a3a3a3', '#000'],
    code: 'literal-color',
    reason:
      'Presenter blackout (the B key, styles.css .tx-deck-stage__blackout): a black screen with a gray hint is the presentation convention and must not follow the deck theme.',
  },
  {
    path: 'packages/slides/src/stage/chrome/DeckBlackout.svelte',
    literals: ['#d4d4d4', '#000', '#fff'],
    code: 'literal-color',
    reason:
      'Presenter blackout screen and its hint: black by convention, independent of the deck theme.',
  },
  {
    path: 'packages/slides/src/stage/chrome/LaserPointer.svelte',
    literals: ['#fff', '#b91c1c', '#ef4444', 'rgb(255 255 255 / 0.8)', 'rgb(239 68 68 / 0.65)'],
    code: 'literal-color',
    reason:
      'Laser pointer: a red dot with a white ring reads over any slide; following the theme could hide it on a red or primary-colored slide.',
  },
  {
    path: 'packages/slides/src/layouts/ImageFullBleed.svelte',
    literals: ['rgb(0 0 0 / 0.45)', 'rgb(255 255 255 / 0.45)'],
    code: 'literal-color',
    reason:
      'Caption scrims over a full-bleed photo: dark or light by the caption tone, over any image.',
  },
  {
    path: 'packages/slides/src/stage/chrome/KeyboardHelp.svelte',
    literals: ['rgb(0 0 0 / 0.5)'],
    code: 'literal-color',
    reason: 'Backdrop of the presenter keyboard help over the slide, which may use any deck theme.',
  },
  // Colors that render today because the token name is not part of the contract.
  {
    path: 'packages/data/src/grid-columns/grid-columns.css',
    literals: ['rgb(0 0 0 / 0.15)'],
    code: 'literal-color',
    reason:
      'Column drag ghost shadow read through --tx-shadow-md, a name no theme declares; the elevation tokens are flat under the visual-baseline theme, so reading them would drop the shadow (pixel change).',
  },
  {
    path: 'packages/pages/src/styles.css',
    literals: ['rgb(0 0 0 / 0.16)'],
    code: 'literal-color',
    reason:
      'Slash menu shadow read through --tx-shadow-md, a name no theme declares; the elevation tokens are flat under the visual-baseline theme, so reading them would drop the shadow (pixel change).',
  },
  // Undefined names that are not colors (unknown-token).
  {
    path: 'packages/',
    literals: [
      '--tx-font-weight-semibold',
      '--tx-text-xs',
      '--tx-text-sm',
      '--tx-text-base',
      '--tx-text-lg',
      '--tx-radius-sm',
      '--tx-radius-md',
      '--tx-radius-lg',
      '--tx-radius-xl',
      '--tx-radius-full',
      '--tx-shadow-md',
      '--tx-shadow-lg',
    ],
    code: 'unknown-token',
    reason: LEGACY_NAME,
  },
  {
    path: 'packages/texuli/src/components/sidebar/sidebar.css',
    literals: ['--tx-sidebar-width', '--tx-sidebar-width-collapsed'],
    code: 'unknown-token',
    reason: HOST_HOOK,
  },
  {
    path: 'packages/texuli/src/components/select/select.css',
    literals: ['--tx-select-trigger-width'],
    code: 'unknown-token',
    reason: HOST_HOOK,
  },
  {
    path: 'packages/texuli/src/components/tags-color/tags-color.css',
    literals: ['--tx-color-picker-hue'],
    code: 'unknown-token',
    reason: `${HOST_HOOK} The value is the hue angle of the picker gradient.`,
  },
  {
    path: 'packages/forms/src/styles.css',
    literals: ['--tx-forms-max-inline-size'],
    code: 'unknown-token',
    reason: HOST_HOOK,
  },
  {
    path: 'packages/media/src/image-editor/Editor.svelte',
    literals: ['--tx-image-editor-edge', '--tx-image-editor-edge-contrast'],
    code: 'unknown-token',
    reason:
      'Crop edge and handle colors a host may set (see the Editor.svelte literal-color entry): white and black over any image by default, on purpose independent of the theme.',
  },
  // Geometry.
  {
    path: 'packages/workflows/src/editor/CanvasNode.svelte',
    literals: ['-12px'],
    code: 'literal-space',
    reason:
      'Centers the 24px port hit target on the node edge (half the target size): pointer geometry, not a space.',
  },
  // Deck scope (slides).
  {
    path: 'packages/slides/src/layouts/',
    literals: ['*px'],
    reason:
      'Slide layouts draw in the deck coordinate space (px that scale with the stage) and read the deck design tokens (--tx-deck-*), not the page design system.',
  },
  { path: 'packages/slides/src/', literals: ['*px', '*rem'], reason: DECK_SCOPE },
  {
    path: 'packages/slides/src/stage/chrome/ChromeTooltip.svelte',
    literals: ['40'],
    code: 'literal-z-index',
    reason:
      'The stage tooltip stacks inside the deck stage, under its own menus; the --tx-z-* layers order page chrome, not the stage internals.',
  },
  {
    path: 'packages/slides/src/styles.css',
    literals: ['1000'],
    code: 'literal-z-index',
    reason:
      'The viewport-fullscreen stage covers the whole host page, above host chrome with arbitrary z-indexes; no page layer token is meant to beat every host layer.',
  },
  { path: 'packages/blocks/src/code/code.css', literals: ['*rem'], reason: DECK_SCOPE },
  {
    path: 'packages/blocks/src/structure/structure.css',
    literals: ['*rem'],
    reason: DECK_SCOPE,
  },
  {
    path: 'packages/charts/src/cartesian/CartesianChart.svelte',
    literals: ['*rem'],
    reason: DECK_SCOPE,
  },
  {
    path: 'packages/charts/src/interaction/interaction.css',
    literals: ['*px', '*rem'],
    reason: DECK_SCOPE,
  },
  { path: 'packages/charts/src/table/', literals: ['*rem'], reason: DECK_SCOPE },
  {
    path: 'packages/media/src/video/VideoPlayer.svelte',
    literals: ['*px', '*rem'],
    reason: DECK_SCOPE,
  },
  // Packages outside this adoption (owner lanes), listed literal by literal.
  {
    path: 'packages/texuli/src/',
    literals: [
      '-0.25rem',
      '-0.35rem',
      '-0.4rem',
      '-0.5rem',
      '-0.65rem',
      '0.05rem',
      '0.125rem',
      '0.15rem',
      '0.1rem',
      '0.25rem',
      '0.2rem',
      '0.35rem',
      '0.375rem',
      '0.3rem',
      '0.45rem',
      '0.4rem',
      '0.55rem',
      '0.5rem',
      '0.625rem',
      '0.65rem',
      '0.6rem',
      '0.75rem',
      '0.7rem',
      '0.85rem',
      '0.8rem',
      '0.9rem',
      '1.15rem',
      '1.1rem',
      '1.25rem',
      '1.5rem',
      '1px',
      '1rem',
      '2rem',
      '3.5rem',
      '3rem',
      '4rem',
      '5rem',
    ],
    code: 'literal-space',
    reason: PENDING,
  },
  {
    path: 'packages/texuli/src/',
    literals: [
      '0.55rem',
      '0.75rem',
      '0.875rem',
      '0.9rem',
      '1.125rem',
      '1.25rem',
      '1.5rem',
      '1rem',
      '2.25rem',
      '2rem',
      '3.25rem',
      '3.5rem',
    ],
    code: 'literal-font-size',
    reason: PENDING,
  },
  {
    path: 'packages/texuli/src/',
    literals: ['0.05rem', '0.1rem', '0.9rem', '1px', '1rem', '3px'],
    code: 'literal-radius',
    reason: PENDING,
  },
  {
    path: 'packages/texuli/src/',
    literals: ['2000', '50'],
    code: 'literal-z-index',
    reason: PENDING,
  },
  {
    path: 'packages/astro/src/',
    literals: ['0.125rem', '0.25rem', '0.5rem', '0.75rem'],
    reason: PENDING,
  },
  {
    path: 'packages/player/src/',
    literals: [
      '0.125rem',
      '0.25rem',
      '0.35rem',
      '0.375rem',
      '0.5rem',
      '0.65rem',
      '0.75rem',
      '0.875rem',
      '1.25rem',
      '1.5rem',
      '1rem',
      '2rem',
      '2.25rem',
      '999px',
    ],
    reason: PENDING,
  },
];

/** The CSS Color 4 system colors (and the deprecated ones still parsed), in their canonical case. */
export const SYSTEM_COLORS: readonly string[] = [
  'AccentColor',
  'AccentColorText',
  'ActiveText',
  'ButtonBorder',
  'ButtonFace',
  'ButtonText',
  'Canvas',
  'CanvasText',
  'Field',
  'FieldText',
  'GrayText',
  'Highlight',
  'HighlightText',
  'LinkText',
  'Mark',
  'MarkText',
  'SelectedItem',
  'SelectedItemText',
  'VisitedText',
  'ActiveBorder',
  'ActiveCaption',
  'AppWorkspace',
  'Background',
  'ButtonHighlight',
  'ButtonShadow',
  'CaptionText',
  'InactiveBorder',
  'InactiveCaption',
  'InactiveCaptionText',
  'InfoBackground',
  'InfoText',
  'Menu',
  'MenuText',
  'Scrollbar',
  'ThreeDDarkShadow',
  'ThreeDFace',
  'ThreeDHighlight',
  'ThreeDLightShadow',
  'ThreeDShadow',
  'Window',
  'WindowFrame',
  'WindowText',
];
// Canonical case only: lowercase words (`canvas`, `field`, `menu`) are grid
// area and animation names far more often than colors in this repository.
const SYSTEM_COLOR = new RegExp(`(?<![\\w-])(?:${SYSTEM_COLORS.join('|')})(?![\\w-])`, 'g');
const TOKEN_READ = /var\(\s*(--tx-[a-zA-Z0-9-]+)/g;

const SPACE_PROP = /^(padding|margin|gap|row-gap|column-gap)(-[a-z-]+)?$/;
const RADIUS_PROP = /^border(-[a-z]+)*-radius$/;
const LENGTH = /(?<![\w.#-])-?\d*\.?\d+(px|rem)\b/g;
const COLOR =
  /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\((?!\s*from\b)[^()]*(?:\([^()]*\)[^()]*)*\)|(?<![\w-])(?:white|black)(?![\w-])/g;

/** Index just past the `)` that closes the `(` at `open`, or -1. */
function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Blank the `var()` fallbacks of contract tokens (same length, so offsets and
 * lines hold): what is left is what can render under a theme.
 */
export function maskContractFallbacks(value: string, contract: ReadonlySet<string>): string {
  let out = value;
  const pattern = /var\(\s*(--[a-zA-Z0-9-]+)\s*,/g;
  for (const match of value.matchAll(pattern)) {
    const name = match[1] as string;
    if (!contract.has(name)) continue;
    const start = match.index as number;
    const end = closing(value, start + 3);
    if (end < 0) continue;
    const from = start + match[0].length;
    out = out.slice(0, from) + ' '.repeat(end - 1 - from) + out.slice(end - 1);
  }
  return out;
}

/** Strip comments and keep only CSS (the `<style>` blocks of a Svelte file), offsets kept. */
export function cssOf(file: string, source: string): string {
  let css = source;
  if (file.endsWith('.svelte')) {
    css = source.replace(/[^\n]/g, ' ');
    for (const match of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      const start = (match.index as number) + match[0].indexOf(match[1] as string);
      css =
        css.slice(0, start) + (match[1] as string) + css.slice(start + (match[1] as string).length);
    }
  }
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

/** The `[start, end)` offsets of every `@media` block whose query names `forced-colors`. */
export function forcedColorsBlocks(css: string): [number, number][] {
  const blocks: [number, number][] = [];
  for (const match of css.matchAll(/@media[^{;]*forced-colors[^{;]*\{/g)) {
    const open = (match.index as number) + match[0].length - 1;
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push([match.index as number, i + 1]);
          break;
        }
      }
    }
  }
  return blocks;
}

/** Blank quoted strings (same length): `content: "Mark"` is text, not a color. */
const maskStrings = (value: string) =>
  value.replace(/"[^"]*"|'[^']*'/g, (text) => ' '.repeat(text.length));

/**
 * The findings of one stylesheet, before the allowlist. `defined` is the set
 * of `--tx-*` names that exist besides the contract (component tokens and
 * names package code declares); without it, `unknown-token` is not checked.
 */
export function scanStylesheet(
  file: string,
  source: string,
  contract: ReadonlySet<string>,
  defined?: ReadonlySet<string>
): TokenUsageFinding[] {
  const css = cssOf(file, source);
  const findings: TokenUsageFinding[] = [];
  const lineAt = (offset: number) => css.slice(0, offset).split('\n').length;
  const forced = forcedColorsBlocks(css);
  const inForced = (offset: number) => forced.some(([from, to]) => offset >= from && offset < to);
  const declaration = /(^|[;{\s])(--[a-zA-Z0-9-]+|[a-z][a-z-]*)(\s*:\s*)([^;{}]*?)(?=\s*(?:;|}))/g;
  for (const match of css.matchAll(declaration)) {
    const prop = match[2] as string;
    const raw = match[4] as string;
    if (!raw.trim()) continue;
    const valueStart =
      (match.index as number) +
      (match[1] as string).length +
      prop.length +
      (match[3] as string).length;
    const value = maskContractFallbacks(raw, contract);
    for (const color of value.matchAll(COLOR)) {
      findings.push({
        file,
        line: lineAt(valueStart + (color.index as number)),
        code: 'literal-color',
        literal: color[0],
        property: prop,
      });
    }
    if (!inForced(valueStart)) {
      for (const system of maskStrings(value).matchAll(SYSTEM_COLOR)) {
        findings.push({
          file,
          line: lineAt(valueStart + (system.index as number)),
          code: 'system-color',
          literal: system[0],
          property: prop,
        });
      }
    }
    if (defined) {
      for (const read of value.matchAll(TOKEN_READ)) {
        const name = read[1] as string;
        if (contract.has(name) || isDefinedName(name, defined)) continue;
        // A host hook in the component-token pattern, `var(--tx-<comp>-<key>,
        // var(--tx-<role>))`, paints the theme until a host sets it.
        const fallback = /^\s*,\s*var\(\s*(--tx-[a-zA-Z0-9-]+)/.exec(
          value.slice((read.index as number) + read[0].length)
        );
        const to = fallback?.[1];
        if (to && (contract.has(to) || isDefinedName(to, defined))) continue;
        findings.push({
          file,
          line: lineAt(valueStart + (read.index as number)),
          code: 'unknown-token',
          literal: name,
          property: prop,
        });
      }
    }
    if (prop.startsWith('--')) continue;
    const code: TokenUsageCode | null = SPACE_PROP.test(prop)
      ? 'literal-space'
      : RADIUS_PROP.test(prop)
        ? 'literal-radius'
        : prop === 'font-size'
          ? 'literal-font-size'
          : null;
    if (code) {
      for (const length of value.matchAll(LENGTH)) {
        // `0px` is zero, and calc() factors of a token are fine.
        if (Number.parseFloat(length[0]) === 0) continue;
        findings.push({
          file,
          line: lineAt(valueStart + (length.index as number)),
          code,
          literal: length[0],
          property: prop,
        });
      }
    }
    if (prop === 'z-index' && /^\s*-?\d+\s*$/.test(value) && Number(value) > 30) {
      findings.push({
        file,
        line: lineAt(valueStart),
        code: 'literal-z-index',
        literal: value.trim(),
        property: prop,
      });
    }
  }
  return findings;
}

const norm = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|[^\d.])\.(\d)/g, '$10.$2');

/** An allowlist literal matches exactly, or by unit when written `*px` (any px length). */
export function literalMatches(pattern: string, literal: string): boolean {
  const want = norm(pattern);
  const found = norm(literal);
  return want.startsWith('*') ? found.endsWith(want.slice(1)) && /\d/.test(found) : want === found;
}

/** True when an allowlist entry covers a finding. */
export function isAllowed(finding: TokenUsageFinding, entry: AllowlistEntry): boolean {
  const pathMatches = entry.path.endsWith('/')
    ? finding.file.startsWith(entry.path)
    : finding.file === entry.path;
  if (!pathMatches) return false;
  if (entry.code && entry.code !== finding.code) return false;
  return entry.literals.some((literal) => literalMatches(literal, finding.literal));
}

/** The contract token names: system tokens, data-viz and every theme-emitted variable. */
export async function contractTokenNames(): Promise<Set<string>> {
  const theme = await loadLibraryTheme('enterprise-neutral');
  const names = new Set<string>(SYSTEM_TOKEN_NAMES);
  for (const mode of ['light', 'dark'] as const) {
    for (const name of Object.keys(themeVariables({ theme, mode }))) names.add(name);
  }
  return names;
}

/** Every `--tx-*` name the component token registry defines (`--tx-<component>-<key>`). */
export function componentTokenNames(): Set<string> {
  return new Set(COMPONENT_TOKENS.map((token) => token.token));
}

const DECLARATIONS = [
  // A CSS declaration, or a style string built in markup or script (`--tx-x: ${v}`).
  /(--tx-[a-zA-Z0-9-]+)\s*:/g,
  // A Svelte style directive.
  /style:(--tx-[a-zA-Z0-9-]+)/g,
  // `style.setProperty('--tx-x', …)` and quoted names in style objects.
  /['"`](--tx-[a-zA-Z0-9-]+)['"`]/g,
];

/** A templated name set from script: `` `--tx-cohort-heat-${index}` `` defines the `--tx-cohort-heat-` family. */
const TEMPLATED = /`(--tx-[a-zA-Z0-9-]+-)\$\{/g;

/**
 * The `--tx-*` names package code declares or sets (see {@link DECLARATIONS});
 * a templated family is kept as its prefix followed by `*`.
 */
export function declaredTokenNames(sources: readonly { source: string }[]): Set<string> {
  const names = new Set<string>();
  for (const { source } of sources) {
    for (const pattern of DECLARATIONS) {
      for (const match of source.matchAll(pattern)) names.add(match[1] as string);
    }
    for (const match of source.matchAll(TEMPLATED)) names.add(`${match[1] as string}*`);
  }
  return names;
}

/** True when `name` is in `defined`, directly or through a templated family (`--tx-cohort-heat-*`). */
export function isDefinedName(name: string, defined: ReadonlySet<string>): boolean {
  if (defined.has(name)) return true;
  for (let end = name.lastIndexOf('-'); end > 4; end = name.lastIndexOf('-', end - 1)) {
    if (defined.has(`${name.slice(0, end + 1)}*`)) return true;
  }
  return false;
}

/** Package sources that may declare or set a `--tx-*` name (tracked files only). */
export function declarationSourceFiles(root = process.cwd()): string[] {
  const listed = execFileSync(
    'git',
    [
      'ls-files',
      ':(glob)packages/*/src/**/*.css',
      ':(glob)packages/*/src/**/*.svelte',
      ':(glob)packages/*/src/**/*.ts',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  return listed.split('\n').filter(Boolean);
}

/** The defined names besides the contract: the component registry and every declared name. */
export function definedTokenNames(
  sources: readonly { source: string }[] = declarationSourceFiles().map((file) => ({
    source: readFileSync(file, 'utf8'),
  }))
): Set<string> {
  const names = componentTokenNames();
  for (const name of declaredTokenNames(sources)) names.add(name);
  return names;
}

/** Package stylesheets the guard scans (tracked files only). */
export function stylesheetFiles(root = process.cwd()): string[] {
  const listed = execFileSync(
    'git',
    ['ls-files', ':(glob)packages/*/src/**/*.css', ':(glob)packages/*/src/**/*.svelte'],
    { cwd: root, encoding: 'utf8' }
  );
  return listed
    .split('\n')
    .filter(Boolean)
    .filter((file) => !/^packages\/(tokens|examples)\//.test(file));
}

export interface TokenUsageReport {
  scanned: number;
  findings: TokenUsageFinding[];
  allowed: number;
  /** Allowlist entries (path and literal) that no finding uses any more. */
  stale: string[];
}

export function checkTokenUsage(
  files: readonly { file: string; source: string }[],
  contract: ReadonlySet<string>,
  allowlist: readonly AllowlistEntry[] = ALLOWLIST,
  defined: ReadonlySet<string> = definedTokenNames(files)
): TokenUsageReport {
  const findings: TokenUsageFinding[] = [];
  const used = new Set<string>();
  let allowed = 0;
  for (const { file, source } of files) {
    for (const finding of scanStylesheet(file, source, contract, defined)) {
      const entry = allowlist.find((candidate) => isAllowed(finding, candidate));
      if (entry) {
        allowed += 1;
        const literal = entry.literals.find((l) => literalMatches(l, finding.literal));
        used.add(`${entry.path} ${norm(literal ?? '')}`);
      } else findings.push(finding);
    }
  }
  const stale = allowlist.flatMap((entry) =>
    entry.literals
      .map((literal) => `${entry.path} ${norm(literal)}`)
      .filter((key) => !used.has(key))
  );
  return { scanned: files.length, findings, allowed, stale };
}

async function main(): Promise<void> {
  const json = process.argv.includes('--json');
  const files = stylesheetFiles().map((file) => ({ file, source: readFileSync(file, 'utf8') }));
  const report = checkTokenUsage(files, await contractTokenNames(), ALLOWLIST, definedTokenNames());
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const f of report.findings) {
      console.error(`${f.file}:${f.line} ${f.code} ${f.property}: ${f.literal}`);
    }
    for (const key of report.stale) console.error(`stale allowlist entry: ${key}`);
  }
  if (report.findings.length > 0 || report.stale.length > 0) {
    console.error(
      `✗ token usage: ${report.findings.length} literal(s) outside the allowlist, ${report.stale.length} stale allowlist entr(ies). Read a contract token (componentVar/systemVar; system colors only inside @media (forced-colors: active)) or add an allowlist entry with its reason.`
    );
    process.exit(1);
  }
  if (!json) {
    console.log(
      `✓ token usage: ${report.scanned} stylesheets, no literal outside the allowlist (${report.allowed} kept with a reason).`
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
