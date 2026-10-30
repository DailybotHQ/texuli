/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createCanvasPlayerHost } from '../../canvas/src/host/index.ts';
import { CANVAS_HOST_PACKAGE, canvasRoot, isCanvasTree } from '../src/canvas-host.ts';
import Player from '../src/Player.svelte';
import { testCanvasHost } from './canvas-host.ts';
import { scenario } from './scenario.ts';

afterEach(cleanup);

/** A canvas blueprint (spec 0.8.0), fictional data only. */
function canvasTree(shapes: unknown[] = [], extra: Record<string, unknown> = {}) {
  return {
    key: 'board',
    id: 'canvas',
    props: {
      canvas: {
        format: 'texuli-canvas',
        formatVersion: 1,
        meta: { title: 'Release board' },
        shapes: [
          { id: 'ask', type: 'ellipse', x: 0, y: 0, width: 160, height: 72, text: 'Ready?' },
          ...shapes,
        ],
        connectors: [],
      },
      ...extra,
    },
  };
}

function paint(blueprint: unknown, props: Record<string, unknown> = {}) {
  const codes: string[] = [];
  const result = render(Player, {
    props: {
      blueprint,
      label: 'Canvas preview',
      onDiagnostics: (event: { diagnostics: readonly { code: string; severity: string }[] }) => {
        for (const d of event.diagnostics) if (d.severity === 'error') codes.push(d.code);
      },
      ...props,
    },
  });
  return { ...result, codes };
}

describe('the canvas host seam', () => {
  it('names the package that owns the viewer and finds canvas roots', () => {
    expect(CANVAS_HOST_PACKAGE).toBe('@texuli/canvas');
    expect(isCanvasTree(canvasTree())).toBe(true);
    expect(isCanvasTree({ id: 'document' })).toBe(false);
    expect(isCanvasTree(null)).toBe(false);
    const root = { kind: 'component', id: 'canvas', props: {}, children: [] } as const;
    expect(canvasRoot([root])).toBe(root);
    expect(canvasRoot([root, root])).toBeNull();
  });

  it('hands a valid canvas to the host, which paints it, and cleans up on unmount', async () => {
    await scenario('canvas host presents a valid canvas', async () => {
      const { host, requests, stop } = testCanvasHost();
      const { container, codes } = paint(canvasTree([], { label: 'Board' }), { canvasHost: host });
      await waitFor(() => expect(requests).toHaveLength(1));
      expect(requests[0]).toMatchObject({ key: 'board', tier: 'untrusted', canvasLabel: 'Board' });
      const surface = container.querySelector('[data-tx-player-canvas-host-surface]');
      expect(requests[0]?.target).toBe(surface);
      expect(surface?.querySelector('[data-test-canvas]')?.textContent).toBe('Release board');
      expect(codes).toEqual([]);
      cleanup();
      expect(stop).toHaveBeenCalledTimes(1);
    });
  });

  it('refuses a canvas without a host, and a hostile canvas with one: nothing paints', async () => {
    await scenario('canvas without a host is refused', async () => {
      const { container, codes } = paint(canvasTree());
      await waitFor(() => expect(codes).toContain('canvas-unchecked'));
      expect(container.querySelector('[data-tx-player-canvas-host-surface]')).toBeNull();
    });
    cleanup();
    await scenario('a hostile canvas is refused by the host check', async () => {
      const { host, requests } = testCanvasHost();
      const hostile = canvasTree([
        {
          id: 'img',
          type: 'image',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          ref: 'javascript:void',
          alt: 'x',
        },
      ]);
      const { container, codes } = paint(hostile, { canvasHost: host });
      await waitFor(() => expect(codes).toContain('canvas-schema'));
      expect(requests).toHaveLength(0);
      expect(container.querySelector('[data-test-canvas]')).toBeNull();
    });
  });

  it('paints through the real @texuli/canvas host: the viewer, named by the canvas title', async () => {
    await scenario('canvas host mounts the viewer', async () => {
      const { container, codes } = paint(canvasTree(), { canvasHost: createCanvasPlayerHost() });
      await waitFor(
        () =>
          expect(
            container.querySelector('[data-tx-player-canvas-host-surface] svg[role="img"]')
          ).not.toBeNull(),
        { timeout: 10_000 }
      );
      expect(
        container
          .querySelector('[data-tx-player-canvas-host-surface] svg[role="img"]')
          ?.getAttribute('aria-label')
      ).toBe('Release board');
      expect(codes).toEqual([]);
    });
  });
});
