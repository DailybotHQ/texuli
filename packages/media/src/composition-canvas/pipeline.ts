// `@texuli/media/composition-canvas/draw`: paint an already validated
// composition and load its images, without the validator. Use it for trusted
// pipelines (a worker, an exporter) that validate once upstream; untrusted data
// goes through `renderComposition` (`@texuli/media/composition-canvas/render`).
export { drawComposition, TEXT_LINE_HEIGHT, viewportRect } from './draw.ts';
export { imageElementLoader, loadCompositionImages } from './images.ts';
export { defaultScratchFactory } from './scratch.ts';
