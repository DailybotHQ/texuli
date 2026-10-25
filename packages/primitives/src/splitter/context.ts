import { createPrimitiveContext } from '../internal/index.ts';
import type { PaneConstraints, SplitterDirection } from './model.ts';

export interface SplitterPaneEntry {
  id: string;
  node: HTMLElement | null;
  constraints: PaneConstraints;
}

/** What a splitter group shares with its panes and handles. */
export interface SplitterContext {
  readonly direction: SplitterDirection;
  readonly layout: readonly number[];
  readonly panes: readonly SplitterPaneEntry[];
  readonly keyboardStep: number;
  readonly disabled: boolean;
  registerPane(entry: SplitterPaneEntry): () => void;
  /** Which handle this is: the number of panes before it, minus one. */
  handleIndex(node: HTMLElement): number;
  /** Whether the group renders right to left. */
  isRtl(): boolean;
  /** The group's size along its axis, in pixels. */
  groupSize(): number;
  setLayout(layout: number[], commit: boolean): void;
}

export const splitterContext = createPrimitiveContext<SplitterContext>('Splitter.Root');
