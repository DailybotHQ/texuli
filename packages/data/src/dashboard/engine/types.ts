/**
 * Dashboard engine types (`@texuli/data/dashboard/engine`). A dashboard is a
 * grid of widgets on whole columns and rows; every position here is in grid
 * units (column and row indexes from 0), never pixels.
 */

/** One widget's place on the grid. */
export interface DashboardItem {
  /** Stable widget id (letters, digits, `-` and `_`; at most 64 characters). */
  readonly id: string;
  /** First column, from 0 (the inline start: the right edge in right-to-left text). */
  readonly x: number;
  /** First row, from 0. */
  readonly y: number;
  /** Width in columns, at least 1. */
  readonly w: number;
  /** Height in rows, at least 1. */
  readonly h: number;
  readonly minW?: number;
  readonly minH?: number;
  readonly maxW?: number;
  readonly maxH?: number;
  /** A locked widget never moves or resizes, and nothing is pushed through it. */
  readonly locked?: boolean;
}

/** Widgets in reading order (by row, then column, then id). */
export type DashboardLayout = readonly DashboardItem[];

/**
 * How free space closes after a change: `vertical` floats every widget up
 * as far as it can go (the usual dashboard), `none` leaves gaps where the
 * person put them.
 */
export type DashboardCompaction = 'vertical' | 'none';

/** A responsive breakpoint: from `minWidth` CSS pixels up, the grid has `columns`. */
export interface DashboardBreakpoint {
  /** Stable id (`lg`, `md`, `sm`…). */
  readonly id: string;
  /** Smallest container inline size, in CSS pixels, this breakpoint applies to. */
  readonly minWidth: number;
  /** Columns at this breakpoint (1 to `DASHBOARD_LIMITS.columns`). */
  readonly columns: number;
}

/** Why a change was refused. */
export type DashboardRefusal =
  /** No widget has that id. */
  | 'unknown-item'
  /** The widget is locked, or the change would move a locked widget. */
  | 'locked'
  /** The widget is already at the grid's edge in that direction (or nothing would change). */
  | 'edge'
  /** The size is outside the widget's minimum or maximum. */
  | 'size';

/** A planned change: the next layout, or the reason it was refused. */
export type DashboardChange =
  | { readonly ok: true; readonly layout: DashboardLayout; readonly item: DashboardItem }
  | { readonly ok: false; readonly reason: DashboardRefusal };

/** Options shared by the layout operations. */
export interface DashboardGridOptions {
  /** Columns in the grid (1 to `DASHBOARD_LIMITS.columns`). */
  readonly columns: number;
  /** Default `vertical`. */
  readonly compaction?: DashboardCompaction;
}

/** A finding while reading an untrusted layout or dashboard state. */
export interface DashboardIssue {
  /** JSON-style path of the value (`layouts.lg[3].w`). */
  readonly path: string;
  readonly message: string;
}

/** The serialized dashboard: one layout per breakpoint id. */
export interface DashboardState {
  readonly format: 'texuli-dashboard';
  readonly formatVersion: 1;
  /** Layouts keyed by breakpoint id (`default` when the dashboard has no breakpoints). */
  readonly layouts: Readonly<Record<string, DashboardLayout>>;
}
