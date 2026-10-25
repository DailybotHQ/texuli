export { default as CompositionSvg } from './CompositionSvg.svelte';
export { escapeXml, isSafeAttrName } from './escape.ts';
export {
  compositionToSvgString,
  renderCompositionSvg,
  serializeSvg,
} from './render.ts';
export type {
  CompositionSvgResult,
  RenderCompositionSvgOptions,
  SvgChild,
  SvgElementNode,
} from './types.ts';
