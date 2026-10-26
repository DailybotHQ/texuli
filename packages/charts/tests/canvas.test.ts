import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CANVAS_POINT_THRESHOLD,
  type CanvasPoint,
  downsampleCanvasPoints,
  drawCanvasChart,
  useCanvas,
} from '../src/canvas/model.ts';
import LineChart from '../src/cartesian/LineChart.svelte';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Canvas chart rendering', () => {
  it('selects canvas only at the configured source-point threshold unless explicitly requested', () => {
    expect(useCanvas('auto', CANVAS_POINT_THRESHOLD - 1)).toBe(false);
    expect(useCanvas('auto', CANVAS_POINT_THRESHOLD)).toBe(true);
    expect(useCanvas('svg', CANVAS_POINT_THRESHOLD * 20)).toBe(false);
    expect(useCanvas('canvas', 1)).toBe(true);
  });

  it('reduces 100k samples to pixel buckets while preserving extrema and null gaps', () => {
    const points: CanvasPoint[] = Array.from({ length: 100_000 }, (_, x) => ({
      x,
      y: x === 50_123 ? 1_000_000 : x === 71_100 ? null : Math.sin(x / 11),
      y0: 300,
    }));
    const sampled = downsampleCanvasPoints(points, 640);

    expect(sampled.length).toBeLessThan(4_000);
    expect(sampled).toContain(points[50_123]);
    expect(sampled).toContain(points[71_100]);
    expect(sampled.map((point) => point.x)).toEqual(
      [...sampled].map((point) => point.x).sort((a, b) => a - b)
    );
  });

  it('draws line marks through a canvas context', () => {
    const context = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      closePath: vi.fn(),
      globalAlpha: 1,
      lineWidth: 1,
      strokeStyle: '',
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
    drawCanvasChart(
      context,
      'line',
      [
        {
          id: 'sales',
          label: 'Sales',
          color: '#246',
          points: [
            { x: 0, y: 2, y0: 100 },
            { x: 10, y: 8, y0: 100 },
          ],
        },
      ],
      640,
      320
    );
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 640, 320);
    expect(context.moveTo).toHaveBeenCalledWith(0, 2);
    expect(context.lineTo).toHaveBeenCalledWith(10, 8);
    expect(context.stroke).toHaveBeenCalledOnce();
  });

  it('uses the lazy canvas renderer for dense data and keeps the accessible description', async () => {
    const context = {
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      closePath: vi.fn(),
      globalAlpha: 1,
      lineWidth: 1,
      strokeStyle: '',
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const points = Array.from({ length: CANVAS_POINT_THRESHOLD }, (_, x) => ({ x, y: x % 17 }));

    render(LineChart, {
      title: 'Dense measurements',
      description: 'Measurements sampled throughout the full reporting period.',
      series: [{ id: 'measurements', label: 'Measurements', color: 'var(--brand, teal)', points }],
    });

    expect(screen.getByRole('img', { name: 'Dense measurements' })).toBeTruthy();
    expect(
      screen.getByText('Measurements sampled throughout the full reporting period.')
    ).toBeTruthy();
    await waitFor(() => expect(document.querySelector('canvas.marks')).toBeTruthy());
    expect(context.stroke).toHaveBeenCalled();
    expect(context.strokeStyle).toBe('teal');
  });
});
