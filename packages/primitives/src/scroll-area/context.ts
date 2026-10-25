import { createPrimitiveContext } from '../internal/context.ts';
import type { ScrollAreaDir, ScrollAreaType, ScrollMetrics } from './types.ts';

export type ScrollbarVisibility = 'hidden' | 'visible';

export interface ScrollAreaContext {
  readonly type: ScrollAreaType;
  readonly dir: ScrollAreaDir;
  readonly scrollHideDelay: number;
  readonly metrics: ScrollMetrics;
  readonly hovering: boolean;
  readonly scrolling: boolean;
  readonly visible: boolean;
  getViewport(): HTMLElement | undefined;
  setViewport(node: HTMLElement | undefined): void;
  setHovering(value: boolean): void;
  notifyScroll(): void;
  scrollTo(options: { top?: number; left?: number }): void;
  scrollbarVisible(orientation: 'horizontal' | 'vertical'): boolean;
}

export const scrollAreaContext = createPrimitiveContext<ScrollAreaContext>('ScrollArea.Root');

export const EMPTY_METRICS: ScrollMetrics = {
  scrollTop: 0,
  scrollLeft: 0,
  scrollWidth: 0,
  scrollHeight: 0,
  clientWidth: 0,
  clientHeight: 0,
};

export function overflowY(m: ScrollMetrics): boolean {
  return m.scrollHeight > m.clientHeight + 1;
}

export function overflowX(m: ScrollMetrics): boolean {
  return m.scrollWidth > m.clientWidth + 1;
}
