/**
 * A canvas host for player tests, as `@texuli/canvas/host` wires one: the
 * `@texuli/canvas` validator as `checkCanvas`, and a `present` that writes
 * the validated title into the target as text (the real host mounts the
 * viewer). The player never imports the canvas engine itself.
 */
import { vi } from 'vitest';
import { checkCanvasDraft } from '../../canvas/src/host/index.ts';
import type {
  CanvasPlayerHost,
  CanvasPlayerHostRequest,
  DraftCanvasCheck,
} from '../src/canvas-host.ts';

export const checkCanvas: DraftCanvasCheck = checkCanvasDraft;

export function testCanvasHost() {
  const requests: CanvasPlayerHostRequest[] = [];
  const stop = vi.fn();
  const host: CanvasPlayerHost = {
    checkCanvas,
    present(request) {
      requests.push(request);
      const checked = checkCanvasDraft(request.canvas, request.tier);
      if (checked.ok && request.target) {
        const figure = document.createElement('figure');
        const title = (checked.canvas as { meta?: { title?: string } }).meta?.title ?? 'Canvas';
        figure.setAttribute('data-test-canvas', title);
        figure.textContent = title;
        request.target.append(figure);
      }
      return () => {
        stop();
        request.target?.replaceChildren();
      };
    },
  };
  return { host, requests, stop };
}
