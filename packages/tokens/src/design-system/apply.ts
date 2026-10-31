/**
 * `@texuli/tokens/design-system/apply` (ADR-023): the design-system runtime.
 * A lazy entry that never reaches the compiler or the color engine.
 *
 * - `applyDesignSystem(el, compiled, { mode })` writes a compiled variable
 *   map on one element in one style write (CSSOM, so a strict `style-src`
 *   allows it), sets the allowlisted attributes, `data-tx-mode` and
 *   `[data-tx-scope]`, registers font faces on first use, hands component
 *   defaults to the host, and returns a dispose that restores the element.
 * - `pickDesignSystemMode(compiled, mode)` is the mode all three paint for a
 *   requested one: that mode when it was compiled, otherwise the first
 *   compiled mode (light, then dark), so a dark-only design system under a
 *   light host paints dark and says so in `data-tx-mode`.
 * - `designSystemStyle(compiled, { selector })` is the same declarations as
 *   a CSS string, for server rendering, with the dark rule.
 * - `designSystemAppearance(compiled, { mode })` is the same map as a
 *   no-flash cache entry (`cacheAppearance` in `@texuli/tokens/no-flash`).
 *
 * Every name and value passes one filter before it reaches a declaration,
 * so the three produce identical variables and none of them can carry a
 * second declaration, a rule or a URL.
 */

import { DESIGN_SYSTEM_ATTRIBUTES, type DesignSystemMode } from './attributes.ts';
import type { CompiledDesignSystem, DesignSystemFontFace } from './compiler.ts';
import {
  CSS_UNSAFE,
  DESIGN_SYSTEM_NAME,
  isSafeCompiledValue as isSafeDesignSystemValue,
} from './css-value.ts';

/**
 * True when `value` is one safe custom-property value: the one check apply,
 * SSR, the replay and the emitters share (`isSafeCompiledValue`).
 */
export { isSafeDesignSystemValue };

/** What the runtime reads from a compiled design system (a cached JSON copy works). */
export type ApplicableDesignSystem = Pick<
  CompiledDesignSystem,
  'id' | 'vars' | 'attrs' | 'fontFaces' | 'defaults'
> & { variant?: string };

export type DesignSystemDefaults = CompiledDesignSystem['defaults'];

export interface ApplyDesignSystemOptions {
  /** The compiled mode to write. */
  mode: DesignSystemMode;
  /** The variant the design system was compiled for (`data-tx-ds-variant`); must match `compiled.variant`. */
  variant?: string;
  /** Register `fontFaces` on the element's document (default `true`). */
  fonts?: boolean;
  /** The base URL relative font paths resolve against (default: the document's base URI). */
  base?: string;
  /** Receives the component defaults (`setDesignDefaults`), and `{}` on dispose. */
  defaults?: (defaults: DesignSystemDefaults) => void;
}

export interface DesignSystemStyleOptions {
  /** The scope selector; default `[data-tx-ds="<id>"]` (plus the variant attribute when compiled for one). */
  selector?: string;
  /** The modes to emit (default, and for an empty list: every compiled mode). With light and dark, dark is the `[data-tx-mode="dark"]` rule. */
  modes?: readonly DesignSystemMode[];
}

const NAME = /^--tx-[a-z0-9-]+$/;
// A relative path without `..` (the origin check below refuses `//host`).
const FONT_PATH = /^(?!.*\.\.)[\w./-]+\.(?:woff2?|ttf|otf)$/;
const FONT_DATA = /^data:font\/(?:woff2?|ttf|otf);base64,[A-Za-z0-9+/]+={0,2}$/;

/** The safe `[name, value]` declarations of one variable map, sorted by name. */
export function designSystemDeclarations(
  vars: Readonly<Record<string, string>>
): [string, string][] {
  const out: [string, string][] = [];
  for (const name of Object.keys(vars).sort()) {
    const value = vars[name];
    if (NAME.test(name) && isSafeDesignSystemValue(value)) out.push([name, value]);
  }
  return out;
}

const MODES: readonly DesignSystemMode[] = ['light', 'dark'];

/**
 * The mode a design system paints for `mode`: `mode` itself when it was
 * compiled, otherwise the first compiled mode (light, then dark). A design
 * system compiled with `color.modes: ["dark"]` paints dark under a light
 * host. `applyDesignSystem`, `designSystemStyle`, `designSystemAppearance`,
 * `DesignSystemProvider`, the player, the pages reader and the slides stage
 * all follow this rule, and write the result as `data-tx-mode`. Throws a
 * `TypeError` for a mode other than `light` or `dark`, or when no mode was
 * compiled.
 */
export function pickDesignSystemMode(
  compiled: Pick<ApplicableDesignSystem, 'vars'>,
  mode: DesignSystemMode
): DesignSystemMode {
  const painted =
    MODES.includes(mode) && [mode, ...MODES].find((candidate) => compiled.vars[candidate]);
  if (!painted) throw new TypeError(`Mode not compiled: ${mode}`);
  return painted;
}

/** The variables of a painted mode (`pickDesignSystemMode` checked it is compiled). */
type ModeVars = Readonly<Record<string, string>>;

const body = (vars: Readonly<Record<string, string>>) =>
  designSystemDeclarations(vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');

/**
 * The compiled variables as CSS for `selector`: the first mode (light when
 * present) on the selector itself, dark on `[data-tx-mode="dark"]` (the
 * scope or an ancestor). The same declarations, in the same order, that
 * `applyDesignSystem` writes. A requested mode that was not compiled is the
 * one {@link pickDesignSystemMode} paints, so a single compiled mode always lands
 * on the selector. Throws a `TypeError` for a selector or id that could leave
 * the rule.
 */
export function designSystemStyle(
  compiled: ApplicableDesignSystem,
  options: DesignSystemStyleOptions = {}
): string {
  const { id, variant } = compiled;
  // The default selector takes the id and variant only as spec names, so a hand-made id such as `x"],*,[x="` cannot widen the rule;
  // braces, `;`, `<` and comments cannot leave it.
  const selector =
    options.selector ??
    (DESIGN_SYSTEM_NAME.test(id) && (!variant || DESIGN_SYSTEM_NAME.test(variant))
      ? `[data-tx-ds="${id}"]${variant ? `[data-tx-ds-variant="${variant}"]` : ''}`
      : '');
  if (typeof selector !== 'string' || !selector.trim() || CSS_UNSAFE.test(selector))
    throw new TypeError('Unsafe selector');
  // The distinct painted modes: a requested mode that was not compiled is the one painted, so
  // the default of both modes (also for an empty list) is every compiled mode.
  const modes = new Set(
    (options.modes?.length ? options.modes : MODES).map((mode) =>
      pickDesignSystemMode(compiled, mode)
    )
  );
  // Light on the selector when painted, else the one mode; dark is its own rule only next to light.
  let css = `${selector}{${body(compiled.vars[modes.has('light') ? 'light' : 'dark'] as ModeVars)}}`;
  if (modes.size > 1) {
    const s = `:is(${selector})`;
    css += `\n${s}[data-tx-mode="dark"],[data-tx-mode="dark"] ${s}:not([data-tx-mode="light"]){${body(compiled.vars.dark as ModeVars)}}`;
  }
  return css;
}

/**
 * The applied variables as a no-flash cache entry: pass it to
 * `cacheAppearance(namespace, …)` and the `noFlashScript` replay writes the
 * same values on `<html>` before first paint. `mode` is the mode painted
 * ({@link pickDesignSystemMode}), which may differ from the one requested.
 */
export function designSystemAppearance(
  compiled: ApplicableDesignSystem,
  options: { mode: DesignSystemMode }
): { themeId: string; mode: DesignSystemMode; vars: Record<string, string> } {
  const mode = pickDesignSystemMode(compiled, options.mode);
  return {
    themeId: compiled.id,
    mode,
    vars: Object.fromEntries(designSystemDeclarations(compiled.vars[mode] as ModeVars)),
  };
}

// ── fonts ────────────────────────────────────────────────────────────────

const registered = /* @__PURE__ */ new WeakMap<Document, Set<string>>();

function fontUrl(src: string, base: string): string | null {
  if (FONT_DATA.test(src)) return src;
  if (!FONT_PATH.test(src)) return null;
  try {
    const from = new URL(base);
    const url = new URL(src, from);
    return /^https?:$/.test(url.protocol) && url.origin === from.origin ? url.href : null;
  } catch {
    return null;
  }
}

function registerFonts(doc: Document, faces: readonly DesignSystemFontFace[], base?: string) {
  const Face =
    (doc.defaultView as (Window & typeof globalThis) | null)?.FontFace ?? globalThis.FontFace;
  const set = doc.fonts as FontFaceSet | undefined;
  if (!Face || !set) return;
  const seen = registered.get(doc) ?? new Set<string>();
  registered.set(doc, seen);
  for (const face of faces) {
    const url = fontUrl(face.src, base ?? doc.baseURI);
    if (
      !url ||
      typeof face.family !== 'string' ||
      CSS_UNSAFE.test(face.family) ||
      !/^\d{1,4}(?: \d{1,4})?$/.test(face.weight)
    )
      continue;
    const key = `${face.family}\n${url}\n${face.weight}\n${face.style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Added unloaded: the browser fetches it when text first uses the family.
    // The family is a plain string and the source is JSON-quoted, so no CSS
    // text is built from either; a descriptor that does not parse fails that
    // face only.
    try {
      set.add(
        new Face(
          face.family,
          `url(${JSON.stringify(url)}) format(${JSON.stringify(face.format)})`,
          {
            weight: face.weight,
            style: face.style === 'italic' ? 'italic' : 'normal',
            display: face.display,
          }
        )
      );
    } catch {}
  }
}

// ── apply ────────────────────────────────────────────────────────────────

interface Applied {
  /** The value and priority each owned variable had before the first apply. */
  vars: Map<string, [string, string]>;
  /** The value each owned attribute had before the first apply. */
  attrs: Map<string, string | null>;
}

/** The current application per element; a fresh object per apply, so stale disposes see a mismatch. */
const applied = /* @__PURE__ */ new WeakMap<HTMLElement, Applied>();
const OWNED_ATTRS = [...DESIGN_SYSTEM_ATTRIBUTES, 'data-tx-mode', 'data-tx-scope'];

const decl = (name: string, value: string, priority: string) =>
  `${name}:${value}${priority ? ` !${priority}` : ''}`;

/**
 * One `cssText` write: the host's own declarations, the original value of
 * every owned name `next` no longer sets, then `next`.
 */
function writeStyle(
  style: CSSStyleDeclaration,
  owned: Applied['vars'],
  next: readonly [string, string][]
) {
  const ours = new Map(next);
  for (const [name] of next)
    if (!owned.has(name))
      owned.set(name, [style.getPropertyValue(name), style.getPropertyPriority(name)]);
  const parts: string[] = [];
  for (let i = 0; i < style.length; i++) {
    const name = style.item(i);
    if (!owned.has(name))
      parts.push(decl(name, style.getPropertyValue(name), style.getPropertyPriority(name)));
  }
  for (const [name, [value, priority]] of owned) {
    if (ours.has(name)) continue;
    if (value) parts.push(decl(name, value, priority));
    owned.delete(name);
  }
  for (const [name, value] of ours) parts.push(`${name}:${value}`);
  style.cssText = parts.join(';');
}

function setAttr(el: HTMLElement, name: string, value: string | null | undefined) {
  if (value == null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/**
 * Apply a compiled design system to `el` (ADR-023). Calling it again on the
 * same element switches mode or design system in one pass (one style
 * write) and keeps the original state for the dispose. Returns a dispose
 * that restores the element as it was before the first apply (one style
 * write); a dispose superseded by a later apply does nothing. Fonts stay
 * registered: other scopes may use them. A mode that was not compiled
 * paints the one {@link pickDesignSystemMode} picks, and `data-tx-mode` names
 * the mode painted.
 */
export function applyDesignSystem(
  el: HTMLElement,
  compiled: ApplicableDesignSystem,
  options: ApplyDesignSystemOptions
): () => void {
  if (!el?.style) throw new TypeError('Not an element');
  const { variant = compiled.variant } = options;
  // A base compile takes no variant either.
  if (variant !== compiled.variant)
    throw new TypeError(`Compiled for variant ${compiled.variant ?? '(none)'}, not ${variant}`);
  const painted = pickDesignSystemMode(compiled, options.mode);
  const next = designSystemDeclarations(compiled.vars[painted] as ModeVars);
  const previous = applied.get(el);
  const state: Applied = {
    vars: previous?.vars ?? new Map(),
    attrs: previous?.attrs ?? new Map(OWNED_ATTRS.map((name) => [name, el.getAttribute(name)])),
  };
  applied.set(el, state);
  writeStyle(el.style, state.vars, next);

  // A cached copy without `attrs` keeps the element's own attributes.
  const attrs = (compiled.attrs ?? {}) as Record<string, unknown>;
  for (const name of DESIGN_SYSTEM_ATTRIBUTES) {
    const value = name === 'data-tx-ds-variant' ? variant : attrs[name];
    // The provider's markup check, so the server HTML and the applied element agree.
    setAttr(
      el,
      name,
      isSafeDesignSystemValue(value) && value.length <= 128 ? value : state.attrs.get(name)
    );
  }
  setAttr(el, 'data-tx-mode', painted);
  // Adds an empty scope; a host-named one is kept.
  el.toggleAttribute('data-tx-scope', true);

  if (options.fonts !== false && compiled.fontFaces?.length)
    registerFonts(el.ownerDocument, compiled.fontFaces, options.base);
  options.defaults?.(compiled.defaults ?? {});

  return () => {
    if (applied.get(el) !== state) return;
    applied.delete(el);
    writeStyle(el.style, state.vars, []);
    for (const [name, value] of state.attrs) setAttr(el, name, value);
    options.defaults?.({});
  };
}
