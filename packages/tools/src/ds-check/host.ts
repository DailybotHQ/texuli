/**
 * `@texuli/tools/ds-check/host` (T-ds-conformance): the browser half of
 * `texuli ds check --render`. A page renders its components inside one
 * scope element, each wrapped in an element carrying
 * `data-ds-check-component="<catalog id>"`, and calls
 * {@link installDsCheckHost}. The render driver then reaches the host as
 * `window.texuliDsCheck`:
 *
 * - `apply(compiled, mode)` puts a compiled design system on the scope
 *   (`applyDesignSystem`, one style write) and waits for fonts and two frames;
 * - `inspect({ pairs })` measures, in the browser:
 *   - every contrast pair of the compiled report, painted through the
 *     cascade inside the scope (`color: var(fg)` on `background: var(bg)`),
 *     from the computed colors;
 *   - every painted color of every component (text color, background,
 *     visible borders and outlines, SVG fill and stroke), once with the
 *     design system and once with every color variable of the scope
 *     inverted. A color that does not move did not come from the `--tx-*`
 *     variables of the scope: a literal, or a variable resolved outside it.
 *
 * Framework-free; no markup is built from strings, and nothing from the
 * compiled design system reaches a sink: `apply` writes through the
 * runtime's filter and the probes use `style.setProperty` with `var(<name>)`
 * of names that match `--tx-[a-z0-9-]+`.
 */
import { type ApplicableDesignSystem, applyDesignSystem } from '@texuli/tokens/design-system/apply';
import {
  DS_CHECK_COMPONENT_ATTRIBUTE,
  DS_CHECK_GLOBAL,
  type DsCheckMode,
  type DsInspectPair,
  type DsInspectResult,
  type DsRenderLiteral,
  type DsRenderPair,
} from './types.ts';

export { DS_CHECK_COMPONENT_ATTRIBUTE, DS_CHECK_GLOBAL, type DsInspectPair };

export interface DsCheckHost {
  /** Resolves when every component painted; the catalog ids painted. */
  ready(): Promise<string[]>;
  apply(compiled: ApplicableDesignSystem, mode: DsCheckMode): Promise<void>;
  inspect(input: { pairs: readonly DsInspectPair[] }): Promise<DsInspectResult>;
}

export interface DsCheckHostOptions {
  /** Resolves once the page painted every component (default: immediately). */
  ready?: () => Promise<unknown>;
}

type Rgba = [number, number, number, number];

const NAME = /^--tx-[a-z0-9-]+$/;
const SIDES = ['top', 'right', 'bottom', 'left'] as const;
/** SVG containers whose shapes are references, never painted where they stand. */
const UNPAINTED = 'defs, clipPath, mask, pattern, marker, symbol';
const SHAPES = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
]);

function frames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) =>
      left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
    step(count);
  });
}

/** A canvas that turns any CSS color into 8-bit sRGB. */
function colorReader(doc: Document): (color: string) => Rgba | undefined {
  const canvas = doc.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return (color) => {
    if (!ctx || !CSS.supports('color', color)) return undefined;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000000';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0] as number, d[1] as number, d[2] as number, (d[3] as number) / 255];
  };
}

function over(top: Rgba, under: Rgba): Rgba {
  const a = top[3];
  return [
    top[0] * a + under[0] * (1 - a),
    top[1] * a + under[1] * (1 - a),
    top[2] * a + under[2] * (1 - a),
    1,
  ];
}

function luminance(c: Rgba): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
}

function ratioOf(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function describe(el: Element): string {
  const classes = [...el.classList].filter((c) => !c.startsWith('svelte-')).slice(0, 2);
  const role = el.getAttribute('role');
  return `${el.tagName.toLowerCase()}${classes.length ? `.${classes.join('.')}` : ''}${role ? `[role=${role}]` : ''}`;
}

function hasOwnText(el: Element): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
  for (const node of el.childNodes)
    if (node.nodeType === 3 && (node.textContent ?? '').trim() !== '') return true;
  return false;
}

/** The painted colors of one element, as computed strings. */
function paintedColors(el: Element): Record<string, string> {
  const style = getComputedStyle(el);
  const out: Record<string, string> = {};
  if (hasOwnText(el)) out.color = style.color;
  out['background-color'] = style.backgroundColor;
  for (const side of SIDES) {
    const width = Number.parseFloat(style.getPropertyValue(`border-${side}-width`));
    const kind = style.getPropertyValue(`border-${side}-style`);
    if (width > 0 && kind !== 'none' && kind !== 'hidden')
      out[`border-${side}-color`] = style.getPropertyValue(`border-${side}-color`);
  }
  if (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0)
    out['outline-color'] = style.outlineColor;
  if (el instanceof SVGElement && SHAPES.has(el.tagName.toLowerCase()) && !el.closest(UNPAINTED)) {
    // A line has no area: its fill never paints.
    if (
      el.tagName.toLowerCase() !== 'line' &&
      style.fill !== 'none' &&
      Number.parseFloat(style.fillOpacity) > 0
    )
      out.fill = style.fill;
    if (style.stroke !== 'none' && Number.parseFloat(style.strokeWidth) > 0)
      out.stroke = style.stroke;
  }
  return out;
}

/**
 * True when `el` clips its whole box away: the visually-hidden pattern
 * (`clip-path: inset(50%)`, or the legacy `clip: rect(0 0 0 0)`), used for
 * screen-reader text and form bridges. It and its subtree paint no pixel.
 */
function clipsAway(el: Element): boolean {
  const style = getComputedStyle(el);
  const inset = /^inset\(\s*(\d+(?:\.\d+)?)%/u.exec(style.clipPath);
  if (inset && Number(inset[1]) >= 50) return true;
  return (
    style.position === 'absolute' &&
    /^rect\(\s*0(?:px)?[\s,]+0(?:px)?[\s,]+0(?:px)?[\s,]+0(?:px)?\s*\)$/u.test(style.clip)
  );
}

/** Whether `el` paints: visible, and neither it nor an ancestor up to `root` clips itself away. */
function isRendered(el: Element, root: Element, clipped: Map<Element, boolean>): boolean {
  const check = (el as Element & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
  const visible = check
    ? check.call(el, { opacityProperty: true, visibilityProperty: true })
    : el.getClientRects().length > 0;
  if (!visible) return false;
  for (let node: Element | null = el; node; node = node === root ? null : node.parentElement) {
    let away = clipped.get(node);
    if (away === undefined) {
      away = clipsAway(node);
      clipped.set(node, away);
    }
    if (away) return false;
  }
  return true;
}

/**
 * Install the host on `scope` and expose it as `window.texuliDsCheck`.
 * Transitions and animations inside the scope are switched off, so a
 * variable switch paints at once (and axe sees settled colors).
 */
export function installDsCheckHost(
  scope: HTMLElement,
  options: DsCheckHostOptions = {}
): DsCheckHost {
  const doc = scope.ownerDocument;
  const read = colorReader(doc);
  const still = new CSSStyleSheet();
  still.replaceSync(
    '[data-ds-check-scope],[data-ds-check-scope] *,[data-ds-check-scope] *::before,[data-ds-check-scope] *::after{transition:none!important;animation:none!important}'
  );
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, still];
  scope.setAttribute('data-ds-check-scope', '');
  let current: { compiled: ApplicableDesignSystem; mode: DsCheckMode } | undefined;

  const components = () =>
    [...scope.querySelectorAll(`[${DS_CHECK_COMPONENT_ATTRIBUTE}]`)].map(
      (el) => el.getAttribute(DS_CHECK_COMPONENT_ATTRIBUTE) as string
    );

  const settle = async () => {
    await doc.fonts?.ready;
    await frames(2);
  };

  const snapshot = () => {
    const map = new Map<Element, Record<string, string>>();
    const clipped = new Map<Element, boolean>();
    for (const root of scope.querySelectorAll(`[${DS_CHECK_COMPONENT_ATTRIBUTE}]`))
      for (const el of [root, ...root.querySelectorAll('*')])
        if (isRendered(el, root, clipped)) map.set(el, paintedColors(el));
    return map;
  };

  /** Invert every color variable of the scope; returns the undo. */
  const invert = (): (() => void) => {
    const vars = current?.compiled.vars[current.mode] ?? {};
    const undo: [string, string][] = [];
    for (const [name, value] of Object.entries(vars)) {
      if (!NAME.test(name) || typeof value !== 'string') continue;
      const rgba = read(value);
      if (!rgba) continue;
      undo.push([name, scope.style.getPropertyValue(name)]);
      scope.style.setProperty(
        name,
        `rgb(${255 - rgba[0]} ${255 - rgba[1]} ${255 - rgba[2]} / ${rgba[3]})`
      );
    }
    return () => {
      for (const [name, value] of undo) scope.style.setProperty(name, value);
    };
  };

  const measurePairs = (pairs: readonly DsInspectPair[]): DsRenderPair[] => {
    const probe = doc.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.setProperty('position', 'absolute');
    probe.style.setProperty('inline-size', '1px');
    probe.style.setProperty('block-size', '1px');
    probe.style.setProperty('overflow', 'hidden');
    scope.append(probe);
    const resolved = (name: string): Rgba | undefined => {
      probe.style.setProperty('color', `var(${name})`);
      return read(getComputedStyle(probe).color);
    };
    const results: DsRenderPair[] = [];
    try {
      const page = resolved('--tx-background') ?? [255, 255, 255, 1];
      const pageSolid = over(page, [255, 255, 255, 1]);
      for (const pair of pairs) {
        if (!NAME.test(pair.foreground) || !NAME.test(pair.background)) continue;
        const bg = resolved(pair.background);
        const fg = resolved(pair.foreground);
        if (!bg || !fg) continue;
        const solidBg = over(bg, pageSolid);
        const ratio = Math.floor(ratioOf(over(fg, solidBg), solidBg) * 100) / 100;
        results.push({
          foreground: pair.foreground,
          background: pair.background,
          kind: pair.kind,
          required: pair.required,
          ratio,
          reported: pair.ratio,
          // 8-bit painting may round a ratio the compiler computed exactly.
          pass: ratio + 0.02 >= pair.required,
        });
      }
    } finally {
      probe.remove();
    }
    return results;
  };

  const host: DsCheckHost = {
    async ready() {
      await options.ready?.();
      await settle();
      return components();
    },
    async apply(compiled, mode) {
      applyDesignSystem(scope, compiled, { mode, fonts: true });
      current = { compiled, mode };
      await settle();
    },
    async inspect({ pairs }) {
      const literals: DsRenderLiteral[] = [];
      const real = snapshot();
      const undo = invert();
      await frames(1);
      const moved = snapshot();
      undo();
      await frames(1);
      for (const [el, colors] of real) {
        const other = moved.get(el);
        if (!other) continue;
        const owner = el.closest(`[${DS_CHECK_COMPONENT_ATTRIBUTE}]`);
        for (const [property, value] of Object.entries(colors)) {
          if (other[property] !== value) continue;
          const rgba = read(value);
          if (!rgba || rgba[3] === 0) continue;
          literals.push({
            component: owner?.getAttribute(DS_CHECK_COMPONENT_ATTRIBUTE) ?? '',
            element: describe(el),
            property,
            value,
          });
        }
      }
      return {
        components: components(),
        pairs: measurePairs(pairs),
        literals,
        checked: real.size,
      };
    },
  };
  (globalThis as Record<string, unknown>)[DS_CHECK_GLOBAL] = host;
  return host;
}
