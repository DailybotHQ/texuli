/**
 * The email dark-mode head rule (ADR-016, ADR-024): a typed, closed rule
 * set, never a free-text stylesheet. After the email is built, every
 * element whose inline style paints a palette color gets a generated class
 * (`tx-bg-<hex>`, `tx-fg-<hex>`, `tx-bd-<hex>`), and one
 * `prefers-color-scheme: dark` rule maps each class to the compiled dark
 * value with `!important` (inline styles win otherwise). Selectors are made
 * of a fixed prefix and a light sRGB hex, declarations of a fixed property
 * and a dark sRGB hex; the whole rule is checked against that grammar
 * before it is written. Nothing from content ever reaches it. Light colors
 * the palette shares (two roles with one light value) share one dark
 * value, in role priority order.
 */
import type { MarkupAttribute, MarkupElement, MarkupNode } from '@texuli/core/markup';
import type { EmailPalette } from './styles.ts';

type Kind = 'bg' | 'fg' | 'bd';

const PROPERTY: Readonly<Record<Kind, string>> = {
  bg: 'background-color',
  fg: 'color',
  bd: 'border-color',
};

/** Which palette roles a light value maps from, per kind, first match wins. */
const ORDER: Readonly<Record<Kind, readonly (keyof EmailPalette)[]>> = {
  bg: [
    'background',
    'surface',
    'primary',
    'infoSoft',
    'successSoft',
    'warningSoft',
    'destructiveSoft',
  ],
  fg: [
    'foreground',
    'muted',
    'link',
    'primaryForeground',
    'infoSoftForeground',
    'successSoftForeground',
    'warningSoftForeground',
    'destructiveSoftForeground',
    'background',
  ],
  bd: ['border'],
};

const HEX = /^#[0-9a-f]{6}$/;
const RULE =
  /^@media \(prefers-color-scheme: dark\)\{(?:\.tx-(?:bg|fg|bd)-[0-9a-f]{6}\{(?:background-color|color|border-color):#[0-9a-f]{6}!important\})+\}$/;

function maps(light: EmailPalette, dark: EmailPalette): Record<Kind, Map<string, string>> {
  const out = { bg: new Map(), fg: new Map(), bd: new Map() } as Record<Kind, Map<string, string>>;
  for (const kind of Object.keys(ORDER) as Kind[]) {
    for (const role of ORDER[kind]) {
      const from = light[role];
      const to = dark[role];
      if (!HEX.test(from) || !HEX.test(to) || out[kind].has(from)) continue;
      out[kind].set(from, to);
    }
  }
  return out;
}

/** The palette colors an inline style paints, per kind (our own serializer's `prop:value;…`). */
function painted(style: string): [Kind, string][] {
  const out: [Kind, string][] = [];
  for (const declaration of style.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const property = declaration.slice(0, colon);
    const value = declaration.slice(colon + 1);
    const hex = /#[0-9a-f]{6}/.exec(value)?.[0];
    if (!hex) continue;
    if (property === 'background-color') out.push(['bg', hex]);
    else if (property === 'color') out.push(['fg', hex]);
    else if (property.startsWith('border')) out.push(['bd', hex]);
  }
  return out;
}

/**
 * Class the elements of an email tree and build its dark rule. Returns the
 * tree unchanged and `css: null` when no painted color changes in dark.
 */
export function emailDarkMode(
  root: MarkupElement,
  light: EmailPalette,
  dark: EmailPalette
): { root: MarkupElement; css: string | null } {
  const table = maps(light, dark);
  const used = new Map<string, string>();
  const visit = (node: MarkupElement): MarkupElement => {
    const children = node.children.map(
      (child): MarkupNode => (child.kind === 'element' ? visit(child) : child)
    );
    const style = node.attributes.find(([name]) => name === 'style')?.[1];
    const classes: string[] = [];
    if (typeof style === 'string') {
      for (const [kind, hex] of painted(style)) {
        const to = table[kind].get(hex);
        if (!to || to === hex) continue;
        const name = `tx-${kind}-${hex.slice(1)}`;
        if (!classes.includes(name)) classes.push(name);
        used.set(name, `${PROPERTY[kind]}:${to}!important`);
      }
    }
    if (classes.length === 0) return { ...node, children };
    const attributes: MarkupAttribute[] = [...node.attributes, ['class', classes.join(' ')]];
    return { ...node, attributes, children };
  };
  const classed = visit(root);
  if (used.size === 0) return { root, css: null };
  const rules = [...used].map(([name, declaration]) => `.${name}{${declaration}}`).join('');
  const css = `@media (prefers-color-scheme: dark){${rules}}`;
  return RULE.test(css) ? { root: classed, css } : { root, css: null };
}
