import { type ClassValue } from 'texuli/cx';
import type { ChartAnnotation } from '../annotations/model.ts';
import type { CanvasRendererMode } from '../canvas/model.ts';
import type { BrushRange, DomainPair } from '../interaction/model.ts';
import type {
  CartesianDomain,
  CartesianSeries,
  CartesianXFormatter,
  CartesianXKind,
} from './model.ts';

/** Props shared by every thin cartesian chart wrapper. */
export type CartesianChartProps = {
  title: string;
  description: string;
  series: readonly CartesianSeries[];
  mode?: 'light' | 'dark';
  renderer?: CanvasRendererMode;
  class?: ClassValue;
  interactive?: boolean;
  /** Optional reference lines, bands, and callout points; max 100 per chart. */
  annotations?: readonly ChartAnnotation[];
  brushInvert?: (pixel: number) => number;
  fullDomain?: DomainPair;
  /** Numeric x-domain to render; one neighboring point is retained at each edge. */
  visibleDomain?: CartesianDomain;
  onzoom?: (domain: DomainPair) => void;
  onbrush?: (domain: DomainPair, pixels: BrushRange) => void;
  onselect?: (selection: {
    seriesId: string;
    index: number;
    x: number | string;
    y: number | null;
  }) => void;
  /**
   * How x values read: `category`, `linear` or `time` (epoch milliseconds,
   * shown as UTC dates in `locale`). Omitted: inferred as before.
   */
  xKind?: CartesianXKind;
  /** Formats x values on the axis, live region, tooltip and data table (developer only). */
  formatX?: CartesianXFormatter;
  /** BCP 47 tag for dates and announced values; default the runtime's locale. */
  locale?: string;
};
