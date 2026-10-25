/**
 * Build an accessible SVG tree from a validated composition.
 * Text stays as `<text>` (not paths). Image sources pass through safeImageSrc.
 */

import { safeImageSrc } from '@texuli/core/url-policy';
import type {
  Composition,
  CompositionFrame,
  CompositionLayer,
  CompositionPaint,
  CompositionTransform,
  ImageLayer,
  ShapeLayer,
  TextLayer,
} from '../composition-model/types.ts';
import { validateComposition } from '../composition-model/validate.ts';
import { escapeXml } from './escape.ts';
import type {
  CompositionSvgResult,
  RenderCompositionSvgOptions,
  SvgChild,
  SvgElementNode,
} from './types.ts';

function el(
  tag: string,
  attrs: Record<string, string> = {},
  children?: SvgChild[]
): SvgElementNode {
  return children === undefined ? { tag, attrs } : { tag, attrs, children };
}

function frameCenter(frame: CompositionFrame): { cx: number; cy: number } {
  return { cx: frame.x + frame.width / 2, cy: frame.y + frame.height / 2 };
}

function transformAttribute(
  frame: CompositionFrame,
  transform: CompositionTransform | undefined
): string | undefined {
  if (!transform) return undefined;
  const parts: string[] = [];
  const tx = transform.translateX ?? 0;
  const ty = transform.translateY ?? 0;
  if (tx !== 0 || ty !== 0) parts.push(`translate(${tx} ${ty})`);

  const { cx, cy } = frameCenter(frame);
  const sx = transform.scaleX ?? 1;
  const sy = transform.scaleY ?? 1;
  if (sx !== 1 || sy !== 1) {
    parts.push(`translate(${cx} ${cy})`, `scale(${sx} ${sy})`, `translate(${-cx} ${-cy})`);
  }

  const rot = transform.rotateDeg ?? 0;
  if (rot !== 0) parts.push(`rotate(${rot} ${cx} ${cy})`);

  return parts.length > 0 ? parts.join(' ') : undefined;
}

function paintId(prefix: string, layerId: string, kind: 'fill' | 'stroke'): string {
  return `tx-paint-${prefix}-${layerId}-${kind}`;
}

function collectPaints(
  layer: CompositionLayer,
  defs: SvgElementNode[]
): { fill?: string; stroke?: string } {
  const result: { fill?: string; stroke?: string } = {};

  if (layer.type === 'shape') {
    if (layer.fill) result.fill = resolvePaint(layer.fill, paintId('f', layer.id, 'fill'), defs);
    if (layer.stroke) {
      result.stroke = resolvePaint(layer.stroke, paintId('s', layer.id, 'stroke'), defs);
    }
  } else if (layer.type === 'text') {
    result.fill = resolvePaint(layer.paint, paintId('t', layer.id, 'fill'), defs);
  }

  return result;
}

function resolvePaint(paint: CompositionPaint, id: string, defs: SvgElementNode[]): string {
  if (paint.kind === 'solid') return paint.color;

  if (paint.kind === 'linear-gradient') {
    const rad = ((paint.angle - 90) * Math.PI) / 180;
    const x2 = 50 + Math.cos(rad) * 50;
    const y2 = 50 + Math.sin(rad) * 50;
    const x1 = 50 - Math.cos(rad) * 50;
    const y1 = 50 - Math.sin(rad) * 50;
    defs.push(
      el(
        'linearGradient',
        {
          id,
          gradientUnits: 'objectBoundingBox',
          x1: String(x1 / 100),
          y1: String(y1 / 100),
          x2: String(x2 / 100),
          y2: String(y2 / 100),
        },
        paint.stops.map((stop) =>
          el('stop', {
            offset: String(stop.offset),
            'stop-color': stop.color,
          })
        )
      )
    );
    return `url(#${id})`;
  }

  // radial
  defs.push(
    el(
      'radialGradient',
      {
        id,
        gradientUnits: 'objectBoundingBox',
        cx: String(paint.center.x),
        cy: String(paint.center.y),
        r: String(paint.radius),
      },
      paint.stops.map((stop) =>
        el('stop', {
          offset: String(stop.offset),
          'stop-color': stop.color,
        })
      )
    )
  );
  return `url(#${id})`;
}

function layerGroupAttrs(
  layer: CompositionLayer,
  paints: { fill?: string; stroke?: string }
): Record<string, string> {
  const attrs: Record<string, string> = {
    id: `layer-${layer.id}`,
    'data-layer-id': layer.id,
    'data-layer-type': layer.type,
  };
  const transform = transformAttribute(layer.frame, layer.transform);
  if (transform) attrs.transform = transform;
  if (layer.opacity !== undefined && layer.opacity !== 1) {
    attrs.opacity = String(layer.opacity);
  }
  if (layer.blendMode && layer.blendMode !== 'normal') {
    attrs.style = `mix-blend-mode:${layer.blendMode}`;
  }
  if (layer.mask) {
    attrs.mask = `url(#tx-mask-${layer.mask.layerId})`;
  }
  if (paints.fill) attrs.fill = paints.fill;
  if (paints.stroke) attrs.stroke = paints.stroke;
  return attrs;
}

function renderShape(
  layer: ShapeLayer,
  paints: { fill?: string; stroke?: string }
): SvgElementNode {
  const { frame } = layer;
  const attrs = layerGroupAttrs(layer, paints);
  if (layer.strokeWidth !== undefined) attrs['stroke-width'] = String(layer.strokeWidth);
  if (!paints.fill) attrs.fill = 'none';
  if (!paints.stroke) attrs.stroke = 'none';

  if (layer.shape === 'rectangle') {
    return el('rect', {
      ...attrs,
      x: String(frame.x),
      y: String(frame.y),
      width: String(frame.width),
      height: String(frame.height),
    });
  }
  if (layer.shape === 'ellipse') {
    const { cx, cy } = frameCenter(frame);
    return el('ellipse', {
      ...attrs,
      cx: String(cx),
      cy: String(cy),
      rx: String(frame.width / 2),
      ry: String(frame.height / 2),
    });
  }
  // line
  return el('line', {
    ...attrs,
    x1: String(frame.x),
    y1: String(frame.y),
    x2: String(frame.x + frame.width),
    y2: String(frame.y + frame.height),
  });
}

function renderText(layer: TextLayer, paints: { fill?: string; stroke?: string }): SvgElementNode {
  const { frame } = layer;
  const attrs = layerGroupAttrs(layer, paints);
  attrs['font-size'] = String(layer.fontSize);
  if (layer.fontWeight) attrs['font-weight'] = String(layer.fontWeight);
  attrs['font-family'] = 'var(--tx-font-sans, system-ui, sans-serif)';

  let x = frame.x;
  const anchor = layer.align ?? 'start';
  if (anchor === 'center') {
    x = frame.x + frame.width / 2;
    attrs['text-anchor'] = 'middle';
  } else if (anchor === 'end') {
    x = frame.x + frame.width;
    attrs['text-anchor'] = 'end';
  } else {
    attrs['text-anchor'] = 'start';
  }

  // Baseline near the top of the frame plus font size (readable, not path-converted).
  const y = frame.y + layer.fontSize;
  attrs.x = String(x);
  attrs.y = String(y);

  // Text content as a child string — kept as text for a11y / selection.
  return el('text', attrs, [layer.text]);
}

function renderImage(layer: ImageLayer, trust: 'developer' | 'untrusted'): SvgElementNode | null {
  const src = safeImageSrc(layer.src, trust);
  if (!src) return null;

  const { frame } = layer;
  const attrs = layerGroupAttrs(layer, {});
  attrs.href = src;
  attrs.x = String(frame.x);
  attrs.y = String(frame.y);
  attrs.width = String(frame.width);
  attrs.height = String(frame.height);
  if (layer.alt !== '') {
    // Decorative empty alt → role presentation via aria-hidden
    attrs['aria-label'] = layer.alt;
  } else {
    attrs['aria-hidden'] = 'true';
  }

  const fit = layer.fit ?? 'fill';
  if (fit === 'contain') attrs.preserveAspectRatio = 'xMidYMid meet';
  else if (fit === 'cover') attrs.preserveAspectRatio = 'xMidYMid slice';
  else attrs.preserveAspectRatio = 'none';

  return el('image', attrs);
}

function buildMaskDef(maskLayer: CompositionLayer, defs: SvgElementNode[]): void {
  const paints = collectPaints(maskLayer, defs);
  let content: SvgElementNode;
  if (maskLayer.type === 'shape') content = renderShape(maskLayer, paints);
  else if (maskLayer.type === 'text') content = renderText(maskLayer, paints);
  else {
    // Image as mask luminance/alpha: use the image itself.
    const img = renderImage(maskLayer, 'developer');
    if (!img) return;
    content = img;
  }

  const maskAttrs: Record<string, string> = {
    id: `tx-mask-${maskLayer.id}`,
    maskUnits: 'userSpaceOnUse',
  };
  // mode is applied by the referencing layer; SVG mask uses alpha of children by default.
  defs.push(el('mask', maskAttrs, [content]));
}

/**
 * Validate (unless skipped) and build an SVG element tree for the composition.
 * Unsafe image sources are omitted from the tree (and rejected by validation when enabled).
 */
export function renderCompositionSvg(
  input: unknown,
  options: RenderCompositionSvgOptions = {}
): CompositionSvgResult {
  const trust = options.trust ?? 'untrusted';
  const shouldValidate = options.validate !== false;

  let composition: Composition;
  if (shouldValidate) {
    const result = validateComposition(input, { trust });
    if (!result.ok) return { ok: false, errors: result.errors };
    composition = result.composition;
  } else {
    composition = input as Composition;
  }

  const defs: SvgElementNode[] = [];
  const body: SvgElementNode[] = [];
  const byId = new Map(composition.layers.map((layer) => [layer.id, layer]));

  // Mask definitions for every layer referenced as a mask.
  const maskIds = new Set<string>();
  for (const layer of composition.layers) {
    if (layer.mask) maskIds.add(layer.mask.layerId);
  }
  for (const maskId of maskIds) {
    const maskLayer = byId.get(maskId);
    if (maskLayer) buildMaskDef(maskLayer, defs);
  }

  for (const layer of composition.layers) {
    // Mask-only helper layers still render if they appear in the stack; authors
    // can hide them with opacity 0. We still draw them in order.
    const paints = collectPaints(layer, defs);
    if (layer.type === 'shape') {
      body.push(renderShape(layer, paints));
    } else if (layer.type === 'text') {
      body.push(renderText(layer, paints));
    } else {
      const image = renderImage(layer, trust);
      if (image) body.push(image);
    }
  }

  const focusable = options.focusable !== false;
  const title = options.title?.trim() || 'Composition';
  const description = options.description?.trim();

  const rootChildren: SvgChild[] = [];
  rootChildren.push(el('title', {}, [title]));
  if (description) rootChildren.push(el('desc', {}, [description]));
  if (defs.length > 0) rootChildren.push(el('defs', {}, defs));
  rootChildren.push(...body);

  const rootAttrs: Record<string, string> = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${composition.width} ${composition.height}`,
    width: String(composition.width),
    height: String(composition.height),
    role: 'img',
    'aria-label': title,
    'data-tx-composition-svg': 'true',
  };
  if (options.className) rootAttrs.class = options.className;
  if (focusable) {
    rootAttrs.tabindex = '0';
    rootAttrs.focusable = 'true';
  }

  return {
    ok: true,
    composition,
    root: el('svg', rootAttrs, rootChildren),
  };
}

/** Serialize an SVG tree to a string. Text nodes are XML-escaped. */
export function serializeSvg(node: SvgElementNode): string {
  return serializeNode(node);
}

function serializeNode(node: SvgElementNode): string {
  const attrParts: string[] = [];
  for (const [key, value] of Object.entries(node.attrs)) {
    attrParts.push(`${key}="${escapeXml(value)}"`);
  }
  const open = attrParts.length > 0 ? `<${node.tag} ${attrParts.join(' ')}` : `<${node.tag}`;
  if (!node.children || node.children.length === 0) {
    return `${open} />`;
  }
  const inner = node.children
    .map((child) => (typeof child === 'string' ? escapeXml(child) : serializeNode(child)))
    .join('');
  return `${open}>${inner}</${node.tag}>`;
}

/** Convenience: validate + render + serialize in one call. */
export function compositionToSvgString(
  input: unknown,
  options?: RenderCompositionSvgOptions
): CompositionSvgResult & { svg?: string } {
  const result = renderCompositionSvg(input, options);
  if (!result.ok) return result;
  return { ...result, svg: serializeSvg(result.root) };
}
