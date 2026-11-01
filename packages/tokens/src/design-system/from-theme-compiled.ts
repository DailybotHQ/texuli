/**
 * `fromTheme` as the compile entries export it: the document of
 * `from-theme.ts`, checked by the compiler (Protoyard G135). A theme that
 * compiles, every library theme included, is returned unchanged. Otherwise:
 * 1. every role is pinned, since a role left to the generator can compile to
 *    another color than the theme's when other roles are pinned;
 * 2. a theme can hold colors the compiler's guarantees refuse (a text role
 *    on its surface below 4.5:1, an input edge below 3:1), and a pinned role
 *    never moves; so each pin a contrast error names is dropped, the
 *    compiler derives that role instead, and the drop is listed in `losses`.
 */
import type { DesignSystem } from '@texuli/spec/design-system';
import { SEMANTIC_ROLES } from '../contract/semantic.ts';
import type { Theme } from '../contract/types.ts';
import { toDocColor } from './color.ts';
import { compileDesignSystem } from './compiler.ts';
import {
  type FromThemeLoss,
  type FromThemeOptions,
  fromThemeWithReport as fromThemeDocument,
} from './from-theme.ts';

const ROLE_PATH = /^\$\.color\.roles\.(light|dark)\.([A-Za-z]+)$/;
/** `--tx-surface-foreground` → `surfaceForeground`. */
const roleOf = (cssVar: string) =>
  cssVar.replace(/^--tx-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

type Pins = Record<string, Record<string, string>>;

/** {@link fromTheme} with the fields it could not carry exactly, or the pins it dropped to compile. */
export function fromThemeWithReport(
  theme: Theme,
  options: FromThemeOptions = {}
): { document: DesignSystem; losses: FromThemeLoss[] } {
  const { document, losses } = fromThemeDocument(theme, options);
  const color = (document as { color?: { roles?: Pins } }).color;
  if (!color || compileDesignSystem(document).ok) return { document, losses };
  const all: Pins = {};
  for (const mode of ['light', 'dark'] as const) {
    const pins: Record<string, string> = {};
    for (const role of SEMANTIC_ROLES) {
      const value = toDocColor(theme[mode][role].default);
      if (value !== undefined) pins[role] = value;
    }
    all[mode] = pins;
  }
  color.roles = all;
  // Each round drops at least one pin, so the loop ends within the pin count.
  for (let round = 0; round < 128; round += 1) {
    const roles = color?.roles;
    if (!roles) break;
    const result = compileDesignSystem(document);
    if (result.ok) break;
    // One drop per failing pair a round, foreground first: a dropped role is
    // derived against the rest, so its other pairs are judged next round.
    const droppedNow = new Set<string>();
    for (const error of result.errors) {
      const match = ROLE_PATH.exec(error.path);
      if (!match) continue;
      const mode = match[1] as string;
      const pins = roles[mode];
      if (!pins) continue;
      const pairs = (error as { pairs?: { foreground: string; background: string }[] }).pairs ?? [];
      const named = [
        match[2] as string,
        ...pairs.map((p) => roleOf(p.foreground)),
        ...pairs.map((p) => roleOf(p.background)),
      ];
      if (named.some((name) => droppedNow.has(`${mode}.${name}`))) continue;
      const role = named.find((name) => pins[name] !== undefined);
      if (role === undefined) continue;
      delete pins[role];
      droppedNow.add(`${mode}.${role}`);
      losses.push({
        path: `$.color.roles.${mode}.${role}`,
        reason: `Below the compiler's contrast guarantee (${error.message}); the role is derived instead.`,
      });
      if (Object.keys(pins).length === 0) delete roles[mode];
    }
    if (Object.keys(roles).length === 0 && color) delete color.roles;
    if (droppedNow.size === 0) break;
  }
  return { document, losses };
}

/** Any Texuli `Theme` as a design-system document that compiles (see {@link fromThemeWithReport}). */
export function fromTheme(theme: Theme, options: FromThemeOptions = {}): DesignSystem {
  return fromThemeWithReport(theme, options).document;
}
