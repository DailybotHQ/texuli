/**
 * The host side of canvases in blueprints, as a host wires it: the
 * `@texuli/canvas` validator behind the catalog's injected `checkCanvas`
 * seam. The catalog itself never imports the canvas engine.
 */
import { checkCanvasDraft } from '../../canvas/src/host/canvas-host.ts';
import type { DraftCanvasCheck } from '../src/validate/canvas.ts';

export const checkCanvas: DraftCanvasCheck = checkCanvasDraft;
