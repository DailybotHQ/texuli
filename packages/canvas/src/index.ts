/**
 * @texuli/canvas: an infinite canvas for Texuli. The root re-exports the
 * framework-free model, the editor and the viewer; import the subpaths
 * (`model`, `sync`, `export`, `editor`, `viewer`, `host`) to load less.
 */
export * from './editor/index.ts';
export * from './model/index.ts';
export { CanvasViewer } from './viewer/index.ts';

/** The package version (first published as `0.8.0`). */
export const CANVAS_PACKAGE_VERSION = '0.10.0';
