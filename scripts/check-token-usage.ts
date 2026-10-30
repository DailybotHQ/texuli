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
 *   with the `--tx-z-*` layers.
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
import { themeVariables } from '../packages/tokens/src/css/apply.ts';
import { loadLibraryTheme } from '../packages/tokens/src/library-port/index.ts';
import { SYSTEM_TOKEN_NAMES } from '../packages/tokens/src/system/names.ts';

export type TokenUsageCode =
  | 'literal-color'
  | 'literal-space'
  | 'literal-radius'
  | 'literal-font-size'
  | 'literal-z-index';

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
    path: 'packages/blocks/src/embed/',
    literals: ['#9ca3af', '#4338ca', '#b91c1c', 'white'],
    code: 'literal-color',
    reason:
      'Embed frame and app chrome read --tx-color-* names that no theme declares, so these fallbacks are what renders; moving them to the contract roles (--tx-border, --tx-primary, --tx-destructive) changes pixels and waits for a visual review (follow-up).',
  },
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

/** The findings of one stylesheet, before the allowlist. */
export function scanStylesheet(
  file: string,
  source: string,
  contract: ReadonlySet<string>
): TokenUsageFinding[] {
  const css = cssOf(file, source);
  const findings: TokenUsageFinding[] = [];
  const lineAt = (offset: number) => css.slice(0, offset).split('\n').length;
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
  allowlist: readonly AllowlistEntry[] = ALLOWLIST
): TokenUsageReport {
  const findings: TokenUsageFinding[] = [];
  const used = new Set<string>();
  let allowed = 0;
  for (const { file, source } of files) {
    for (const finding of scanStylesheet(file, source, contract)) {
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
  const report = checkTokenUsage(files, await contractTokenNames());
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
      `✗ token usage: ${report.findings.length} literal(s) outside the allowlist, ${report.stale.length} stale allowlist entr(ies). Read a token (componentVar/systemVar) or add an allowlist entry with its reason.`
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
