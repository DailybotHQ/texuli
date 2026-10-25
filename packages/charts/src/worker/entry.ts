import { handleChartOffload } from './handler.ts';
import type { ChartOffloadRequest } from './protocol.ts';
import { transferables } from './protocol.ts';

/*
 * The worker script for `createChartOffload`. Load it as a module worker:
 *   new Worker(new URL('@texuli/charts/worker/entry', import.meta.url), { type: 'module' })
 * It answers each request with the synchronous chart math and transfers the
 * result buffers back. Importing it outside a worker does nothing.
 */

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  postMessage(message: unknown, transfer: ArrayBuffer[]): void;
}

const scope = globalThis as unknown as Partial<WorkerScope> & { document?: unknown };

// A window has `document`; a dedicated worker does not.
if (scope.document === undefined && typeof scope.addEventListener === 'function') {
  scope.addEventListener('message', (event) => {
    const response = handleChartOffload(event.data as ChartOffloadRequest);
    scope.postMessage?.(response, transferables(response));
  });
}
