import { getContext, type Snippet, setContext } from 'svelte';

/** What a `DashboardWidget` tells its dashboard (getters read the widget's live props). */
export interface DashboardWidgetEntry {
  readonly id: string;
  readonly title: string;
  /** The widget's own placement on the widest grid, used when the dashboard has no layout for it. */
  readonly place: {
    readonly x?: number;
    readonly y?: number;
    readonly w?: number;
    readonly h?: number;
    readonly minW?: number;
    readonly minH?: number;
    readonly maxW?: number;
    readonly maxH?: number;
    readonly locked?: boolean;
  };
  readonly content: Snippet | undefined;
}

export interface DashboardContext {
  /** Registers a widget; returns the function that removes it. */
  register(entry: DashboardWidgetEntry): () => void;
}

const KEY = Symbol('tx-dashboard');

export function setDashboardContext(context: DashboardContext): void {
  setContext(KEY, context);
}

export function getDashboardContext(): DashboardContext | null {
  return getContext<DashboardContext | undefined>(KEY) ?? null;
}
