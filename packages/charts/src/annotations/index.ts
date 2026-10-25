/** Data-driven annotation primitives shared by Cartesian and matrix charts. */
export { default as AnnotationLayer } from './AnnotationLayer.svelte';
export {
  type AnnotationScales,
  annotationInteractionSeries,
  assertCartesianAnnotations,
  assertChartAnnotations,
  type ChartAnnotation,
  type ChartAxisValue,
  projectAnnotations,
  type RenderedAnnotation,
} from './model.ts';
