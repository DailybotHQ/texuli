// @vitest-environment node
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkLockedRenderTree,
  DS_LOCKED_RENDER_EXEMPT_IDS,
  isLockedVisualizationMark,
} from '../src/ds-check/locked-render.ts';

let window: Window | undefined;
afterEach(() => {
  window?.happyDOM.close();
  window = undefined;
});

function root(markup: string): HTMLElement {
  window ??= new Window();
  const scope = window.document.createElement('main');
  scope.innerHTML = markup;
  window.document.body.append(scope);
  return scope as unknown as HTMLElement;
}

const allow = (ids: readonly string[]) => ({
  allow: Object.fromEntries(ids.map((id) => [id, {}])),
});

describe('locked render runtime mapping', () => {
  it('passes a clean allowed component tree', () => {
    expect(
      checkLockedRenderTree(
        root('<button data-tx-component="button">Save</button>'),
        allow(['button'])
      )
    ).toMatchObject({ ok: true, codes: [], errors: [] });
  });

  it('fails an interactive control outside a catalog component root', () => {
    const report = checkLockedRenderTree(root('<button>Unmapped</button>'), allow(['button']));
    expect(report.ok).toBe(false);
    expect(report.codes).toContain('unmapped');
  });

  it('fails a component root excluded by the locked allow set', () => {
    const report = checkLockedRenderTree(
      root('<button data-tx-component="button">Save</button>'),
      allow(['card'])
    );
    expect(report.codes).toContain('not-allowed');
  });

  it('declares only chart, map and canvas catalog roots as visualization exemptions', () => {
    expect(DS_LOCKED_RENDER_EXEMPT_IDS).toEqual(['canvas', 'data-map', 'charts-*']);
    expect(isLockedVisualizationMark('charts-line', 'path.mark', 'fill')).toBe(true);
    expect(isLockedVisualizationMark('data-map', 'circle', 'stroke')).toBe(true);
    expect(isLockedVisualizationMark('canvas', 'rect', 'fill')).toBe(true);
    expect(isLockedVisualizationMark('charts-line', 'text', 'fill')).toBe(false);
    expect(isLockedVisualizationMark('charts-line', 'button', 'background-color')).toBe(false);
    expect(isLockedVisualizationMark('button', 'path', 'fill')).toBe(false);
  });
});
