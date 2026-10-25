/**
 * `@texuli/media/image-editor`: the editor component, its labels and types.
 * The framework-free model is `@texuli/media/image-editor/model`; drawing,
 * loading and export are `@texuli/media/image-editor/render`.
 */
export { default as ImageEditor } from './ImageEditor.svelte';
export {
  DEFAULT_IMAGE_EDITOR_LABELS,
  describeEdit,
  fillLabel,
  type ImageEditorLabels,
  resolveImageEditorLabels,
} from './labels.ts';
export { cropToAspectRatio } from './model.ts';
export type {
  Annotation,
  AnnotationPatch,
  AnnotationType,
  ArrowAnnotation,
  EditAction,
  FilterName,
  ImageEdit,
  ImageEditIssue,
  ImageEditValidation,
  ImageFilters,
  NormalizedRect,
  QuarterTurn,
  RectAnnotation,
  SourceSize,
  TextAnnotation,
} from './types.ts';
