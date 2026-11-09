import {
  type CanvasDocument,
  type CanvasXY,
  connectOps,
  createCanvasHistory,
  moveOps,
  shapeAt,
} from '@texuli/canvas/model';
import { launchPlanFixture } from './fixtures/launch-plan.ts';

export interface CanvasDemoView {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface CanvasDemoModel {
  readonly doc: CanvasDocument;
  readonly selection: readonly string[];
  readonly view: CanvasDemoView;
  readonly canUndo: boolean;
  selectAt(point: CanvasXY, additive?: boolean): string | null;
  moveSelection(delta: CanvasXY): boolean;
  addPriorityNote(): string | null;
  connectSelection(): string | null;
  panBy(delta: CanvasXY): void;
  zoomBy(factor: number): void;
  undo(): boolean;
  reset(): void;
}

const clampZoom = (zoom: number) => Math.max(0.5, Math.min(2, Math.round(zoom * 100) / 100));

/**
 * Small state adapter for the canvas demo. Document edits use the published
 * `@texuli/canvas/model` operations; view pan and zoom are demo-local state,
 * matching the editor's separation between canvas data and viewport.
 */
export function createCanvasDemoModel(): CanvasDemoModel {
  const initial = launchPlanFixture();
  const history = createCanvasHistory(initial);
  let selected: string[] = [];
  let view = { x: 0, y: 0, zoom: 1 };
  let nextNote = 1;

  const selection = () => [...selected];
  const apply = (ops: Parameters<typeof history.apply>[0], label: string): boolean =>
    history.apply(ops, { label }).ok;

  return {
    get doc() {
      return history.doc;
    },
    get selection() {
      return selection();
    },
    get view() {
      return { ...view };
    },
    get canUndo() {
      return history.canUndo;
    },
    selectAt(point, additive = false) {
      const id = shapeAt(history.doc, point);
      if (!additive) selected = id ? [id] : [];
      else if (id && !selected.includes(id)) selected = [...selected, id];
      return id;
    },
    moveSelection(delta) {
      const ops = moveOps(history.doc, selected, delta);
      return ops.length > 0 && apply(ops, 'Move selection');
    },
    addPriorityNote() {
      const id = `priority-note-${nextNote++}`;
      const result = history.apply(
        [
          {
            op: 'add',
            shape: {
              id,
              type: 'sticky',
              x: 1016,
              y: 208 + nextNote * 8,
              width: 168,
              height: 96,
              text: 'Confirm beta launch date',
              color: 'yellow',
            },
          },
        ],
        { label: 'Add a priority note' }
      );
      if (!result.ok) return null;
      selected = [id];
      return id;
    },
    connectSelection() {
      if (selected.length !== 2) return null;
      const id = `demo-connector-${history.doc.connectors.length + 1}`;
      const result = history.apply(
        connectOps({ shape: selected[0] as string }, { shape: selected[1] as string }, id, {
          routing: 'elbow',
        }),
        { label: 'Connect selected notes' }
      );
      return result.ok ? id : null;
    },
    panBy(delta) {
      if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return;
      view = { ...view, x: view.x + delta.x, y: view.y + delta.y };
    },
    zoomBy(factor) {
      if (!Number.isFinite(factor) || factor <= 0) return;
      view = { ...view, zoom: clampZoom(view.zoom * factor) };
    },
    undo() {
      const step = history.undo();
      if (!step) return false;
      selected = [];
      return true;
    },
    reset() {
      history.reset(launchPlanFixture());
      selected = [];
      view = { x: 0, y: 0, zoom: 1 };
      nextNote = 1;
    },
  };
}
