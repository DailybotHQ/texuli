/**
 * Static SVG of a canvas through `@texuli/core/markup`: typed, escaped
 * nodes only (no raw markup), an element and attribute allowlist, image
 * URLs through the URL policy at the tier (`untrusted` by default), and
 * fixed colors (an exported file carries no theme). Linear in the canvas.
 */
import { el, imageUrl, type MarkupElement, serializeXml } from '@texuli/core/markup';
import type { HrefTrust } from '@texuli/core/url-policy';
import { routeConnector } from '../model/connectors.ts';
import { canvasBounds, indexShapes, isContainer } from '../model/document.ts';
import {
  dashArray,
  EXPORT_PALETTE,
  paintedText,
  resolvePaint,
  shapeOutline,
  shapeTransform,
  textLayout,
} from '../model/paint.ts';
import type { BoxedShape, CanvasDocument, CanvasShape } from '../model/types.ts';

export interface SvgExportOptions {
  /** URL tier for resolved image URLs. Default `untrusted`. */
  trust?: HrefTrust;
  /** Turn an image `ref` into a URL; without it images export as their alt text. */
  resolveImage?: (ref: string) => string | null | undefined;
  /** Space around the content (default 24). */
  padding?: number;
  /** Paint a white background (default true). */
  background?: boolean;
  /** Reading direction for text alignment (default `ltr`). */
  dir?: 'ltr' | 'rtl';
  /** Export only these shapes (and connectors between them). */
  ids?: Iterable<string>;
}

/** Elements and attributes the export writes; everything else is refused at serialization. */
export const SVG_ELEMENTS: ReadonlySet<string> = new Set(
  'svg title desc defs marker clipPath g rect ellipse path text tspan image circle'.split(' ')
);
const SVG_ATTRIBUTES = new Set(
  (
    'xmlns viewBox width height role aria-labelledby id x y rx ry cx cy r d fill stroke ' +
    'stroke-width stroke-dasharray stroke-linecap stroke-linejoin opacity transform clip-path ' +
    'marker-end marker-start markerWidth markerHeight refX refY orient font-size font-family ' +
    'font-weight text-anchor dy href preserveAspectRatio'
  ).split(' ')
);

const allow = (name: string, what: 'element' | 'attribute') =>
  what === 'element' ? SVG_ELEMENTS.has(name) : SVG_ATTRIBUTES.has(name);

const tenth = (value: number) => Math.round(value * 10) / 10;

const paint = (name: string) =>
  name === 'none' ? 'none' : (EXPORT_PALETTE[name as keyof typeof EXPORT_PALETTE] ?? 'none');

function fillOf(name: string, kind: string): string {
  if (name === 'none') return 'none';
  // Fills are tints, so text stays readable on them.
  const base = paint(name);
  return kind === 'sticky' ? `${base}33` : `${base}22`;
}

/** The SVG text of a canvas (no XML declaration). */
export function canvasToSvg(doc: CanvasDocument, options: SvgExportOptions = {}): string {
  return serializeXml(canvasSvgElement(doc, options), { declaration: false, allow });
}

/** The SVG as a markup tree (to embed in another markup document). */
export function canvasSvgElement(
  doc: CanvasDocument,
  options: SvgExportOptions = {}
): MarkupElement {
  const trust = options.trust ?? 'untrusted';
  const dir = options.dir ?? 'ltr';
  const padding = options.padding ?? 24;
  const index = indexShapes(doc);
  const only = options.ids ? new Set(options.ids) : null;
  const roots = only ? doc.shapes.filter((shape) => only.has(shape.id)) : doc.shapes;
  const bounds = canvasBounds({ ...doc, shapes: roots });
  const box = {
    x: tenth(bounds.x - padding),
    y: tenth(bounds.y - padding),
    width: tenth(Math.max(1, bounds.width + padding * 2)),
    height: tenth(Math.max(1, bounds.height + padding * 2)),
  };
  let clipCount = 0;
  const defs: MarkupElement[] = [
    el(
      'marker',
      {
        id: 'tx-arrow',
        viewBox: '0 0 10 10',
        refX: 9,
        refY: 5,
        markerWidth: 8,
        markerHeight: 8,
        orient: 'auto-start-reverse',
      },
      el('path', { d: 'M0 0L10 5L0 10z', fill: 'context-stroke' })
    ),
    el(
      'marker',
      { id: 'tx-dot', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 6, markerHeight: 6 },
      el('circle', { cx: 5, cy: 5, r: 4, fill: 'context-stroke' })
    ),
  ];

  const textOf = (shape: BoxedShape): MarkupElement | null => {
    const value = paintedText(shape);
    if (!value) return null;
    const layout = textLayout(shape, value, dir);
    return el(
      'text',
      {
        x: layout.x,
        y: layout.y,
        'font-size': layout.size,
        'font-family': 'system-ui, sans-serif',
        'font-weight': shape.type === 'frame' ? 600 : undefined,
        'text-anchor': layout.anchor,
        fill: EXPORT_PALETTE.default,
      },
      layout.lines.map((line, i) =>
        el('tspan', { x: layout.x, dy: i === 0 ? 0 : layout.step }, line)
      )
    );
  };

  const shapeNode = (shape: CanvasShape): MarkupElement => {
    if (shape.type === 'group') return el('g', {}, shape.children.map(shapeNode));
    const style = resolvePaint(shape);
    const stroke = paint(style.stroke);
    const common = {
      fill:
        shape.type === 'line' || shape.type === 'arrow' || (shape.type === 'path' && !shape.closed)
          ? 'none'
          : fillOf(style.fill, shape.type),
      stroke,
      'stroke-width': stroke === 'none' ? undefined : style.strokeWidth,
      'stroke-dasharray': dashArray(style.dash, style.strokeWidth),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    };
    const parts: MarkupElement[] = [];
    if (shape.type === 'image') {
      const resolved = options.resolveImage?.(shape.ref);
      const url = typeof resolved === 'string' ? imageUrl(resolved, trust) : null;
      if (url)
        parts.push(
          el('image', {
            href: url,
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            preserveAspectRatio: 'xMidYMid meet',
          })
        );
      else {
        parts.push(
          el('rect', {
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            fill: '#f6f8fa',
            stroke: '#d0d7de',
          })
        );
        parts.push(
          el(
            'text',
            {
              x: tenth(shape.x + shape.width / 2),
              y: tenth(shape.y + shape.height / 2),
              'font-size': 14,
              'text-anchor': 'middle',
              fill: EXPORT_PALETTE.gray,
            },
            shape.alt
          )
        );
      }
    } else {
      const outline = shapeOutline(shape);
      if (outline.kind === 'rect')
        parts.push(
          el('rect', {
            x: outline.x,
            y: outline.y,
            width: outline.width,
            height: outline.height,
            rx: outline.rx || undefined,
            ...common,
          })
        );
      else if (outline.kind === 'ellipse')
        parts.push(
          el('ellipse', {
            cx: outline.cx,
            cy: outline.cy,
            rx: outline.rx,
            ry: outline.ry,
            ...common,
          })
        );
      else if (outline.kind === 'path')
        parts.push(
          el('path', {
            d: outline.d,
            ...common,
            'marker-end': shape.type === 'arrow' ? 'url(#tx-arrow)' : undefined,
          })
        );
    }
    const label = shape.type === 'image' ? null : textOf(shape);
    if (shape.type === 'frame') {
      clipCount += 1;
      const clip = `tx-clip-${clipCount}`;
      defs.push(
        el(
          'clipPath',
          { id: clip },
          el('rect', { x: shape.x, y: shape.y, width: shape.width, height: shape.height })
        )
      );
      return el(
        'g',
        { transform: shapeTransform(shape) },
        parts,
        label,
        el('g', { 'clip-path': `url(#${clip})` }, shape.children.map(shapeNode))
      );
    }
    return el(
      'g',
      { transform: shapeTransform(shape), opacity: style.opacity < 1 ? style.opacity : undefined },
      parts,
      label
    );
  };

  const shapes = roots.map(shapeNode);
  const exported = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const shape = stack.pop() as CanvasShape;
    exported.add(shape.id);
    if (isContainer(shape)) stack.push(...shape.children);
  }
  const lookup = new Map([...index].map(([id, entry]) => [id, entry.shape]));
  const connectors = doc.connectors.flatMap((connector) => {
    const inside = (end: typeof connector.from) => !('shape' in end) || exported.has(end.shape);
    if (only && (!inside(connector.from) || !inside(connector.to))) return [];
    const route = routeConnector(connector, lookup);
    if (!route) return [];
    const style = resolvePaint(connector, 'connector');
    const cap = (value: string | undefined, fallback: string) => {
      const name = value ?? fallback;
      return name === 'arrow' ? 'url(#tx-arrow)' : name === 'dot' ? 'url(#tx-dot)' : undefined;
    };
    return [
      el(
        'g',
        {},
        el('path', {
          d: route.path,
          fill: 'none',
          stroke: paint(style.stroke),
          'stroke-width': style.strokeWidth,
          'stroke-dasharray': dashArray(style.dash, style.strokeWidth),
          'marker-start': cap(connector.startCap, 'none'),
          'marker-end': cap(connector.endCap, 'arrow'),
        }),
        connector.text
          ? el(
              'text',
              {
                x: tenth(route.mid.x),
                y: tenth(route.mid.y - 6),
                'font-size': 13,
                'text-anchor': 'middle',
                fill: EXPORT_PALETTE.default,
              },
              connector.text
            )
          : null
      ),
    ];
  });

  const title = doc.meta?.title ?? 'Canvas';
  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `${box.x} ${box.y} ${box.width} ${box.height}`,
      width: box.width,
      height: box.height,
      role: 'img',
      'aria-labelledby': 'tx-canvas-title',
    },
    el('title', { id: 'tx-canvas-title' }, title),
    doc.meta?.description ? el('desc', {}, doc.meta.description) : null,
    el('defs', {}, defs),
    options.background === false ? null : el('rect', { ...box, fill: '#ffffff' }),
    shapes,
    connectors
  );
}
