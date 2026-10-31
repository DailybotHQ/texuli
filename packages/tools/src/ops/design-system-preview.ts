/**
 * The static SVG snapshot `ds.preview` returns for `format: "svg"`: one
 * panel per compiled mode with the key role swatches, a primary button, a
 * card and the contrast count. Deterministic by construction: a fixed font
 * stack, fixed geometry, no time and no random ids. Every text and
 * attribute value goes through `escapeHtml` of the report emitter, and a
 * color is written only when it passes `isSafeCompiledValue` and a closed
 * color form; nothing is ever parsed as markup.
 */
import type { CompiledDesignSystem } from '@texuli/tokens/design-system/compile';
import { isSafeCompiledValue } from '@texuli/tokens/design-system/emit';
import { escapeHtml } from '@texuli/tokens/design-system/report';

/** The roles the snapshot shows as swatches, in order. */
export const PREVIEW_SWATCHES = [
  'primary',
  'secondary',
  'accent',
  'muted',
  'destructive',
  'success',
  'warning',
  'info',
] as const;

const WIDTH = 640;
const PANEL = 232;
const GAP = 16;
/** A fixed stack, so the snapshot never depends on the document's fonts. */
const FONT = 'system-ui, sans-serif';
const COLOR = /^(?:#[0-9a-f]{3,8}|(?:oklch|rgba?|hsla?)\([\d\s.,%/+-]+\))$/i;
const FALLBACK = '#808080';

/** A color safe to write as an SVG paint, or the neutral fallback. */
function paint(value: unknown): string {
  return isSafeCompiledValue(value) && COLOR.test(value) ? value : FALLBACK;
}

/** A `rem` or `px` radius as SVG user units, clamped to the button's half height. */
function radiusPx(value: unknown): number {
  const match = typeof value === 'string' ? /^(\d+(?:\.\d+)?)(rem|px)$/.exec(value) : null;
  if (!match) return 0;
  const px = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
  return Math.min(20, Math.round(px * 100) / 100);
}

const attr = (name: string, value: string | number) => `${name}="${escapeHtml(value)}"`;

function text(x: number, y: number, fill: string, size: number, content: string, weight = 400) {
  return `<text ${attr('x', x)} ${attr('y', y)} ${attr('fill', fill)} ${attr('font-size', size)} ${attr('font-weight', weight)}>${escapeHtml(content)}</text>`;
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  extra: Record<string, string | number> = {}
) {
  const more = Object.entries(extra)
    .map(([name, value]) => ` ${attr(name, value)}`)
    .join('');
  return `<rect ${attr('x', x)} ${attr('y', y)} ${attr('width', width)} ${attr('height', height)} ${attr('fill', fill)}${more}/>`;
}

/** The snapshot as SVG text. The same compiled input always gives the same bytes. */
export function previewSvg(compiled: CompiledDesignSystem): string {
  const modes = (['light', 'dark'] as const).filter((mode) => compiled.vars[mode]);
  const height = GAP + modes.length * (PANEL + GAP);
  const title = `${compiled.name || compiled.id} ${compiled.version}`.trim();
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" ${attr('width', WIDTH)} ${attr('height', height)} ${attr('viewBox', `0 0 ${WIDTH} ${height}`)} role="img" ${attr('aria-label', `${title} design system preview`)} ${attr('font-family', FONT)}>`,
    `<title>${escapeHtml(`${title} design system preview`)}</title>`,
  ];
  modes.forEach((mode, index) => {
    const vars = (compiled.vars[mode] ?? {}) as Record<string, string>;
    const v = (name: string) => paint(vars[`--tx-${name}`]);
    const top = GAP + index * (PANEL + GAP);
    const left = GAP;
    const radius = radiusPx(vars['--tx-radius']);
    const pairs = compiled.report.contrast[mode] ?? [];
    const passing = pairs.filter((pair) => pair.pass).length;
    parts.push(
      `<g ${attr('data-mode', mode)}>`,
      rect(left, top, WIDTH - 2 * GAP, PANEL, v('background'), {
        rx: 12,
        stroke: v('border'),
      }),
      text(left + 16, top + 28, v('foreground'), 16, `${title} · ${mode}`, 600),
      text(
        left + 16,
        top + 48,
        v('muted-foreground'),
        12,
        `${passing}/${pairs.length} contrast pairs pass (${compiled.accessibility.contrast})`
      )
    );
    PREVIEW_SWATCHES.forEach((role, at) => {
      const x = left + 16 + at * 74;
      parts.push(
        rect(x, top + 64, 64, 40, v(role), { rx: 6, stroke: v('border') }),
        text(x + 8, top + 89, v(`${role}-foreground`), 12, 'Aa', 600),
        text(x, top + 120, v('muted-foreground'), 10, role)
      );
    });
    parts.push(
      rect(left + 16, top + 140, 148, 40, v('primary'), { rx: radius }),
      text(left + 32, top + 165, v('primary-foreground'), 14, 'Primary action', 600),
      rect(left + 180, top + 136, WIDTH - 2 * GAP - 196, 80, v('surface'), {
        rx: radius,
        stroke: v('border'),
      }),
      text(left + 196, top + 162, v('surface-foreground'), 14, 'Card title', 600),
      text(left + 196, top + 184, v('muted-foreground'), 12, 'Supporting text on the surface.'),
      text(left + 196, top + 204, v('link'), 12, 'A link')
    );
    parts.push('</g>');
  });
  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}
