/*
 * The dependency graph of ADR-015. Formula cells are nodes keyed by stable
 * cell keys (sheet, row id, column id). A single-cell reference is one edge
 * in a reverse index; a range is stored as an interval per column it spans
 * (never expanded into one edge per cell), so `=SUM(A1:A10000)` costs one
 * entry, and finding who reads a cell scans only its column's intervals.
 *
 * `dirtyOrder` walks from changed cells to every formula that depends on
 * them, orders those formulas topologically (Kahn) and finds the cycles
 * among the rest with an iterative Tarjan pass, so only the dirty subgraph
 * is recalculated and a cycle is reported instead of looping. Every
 * dependent and interval visited counts as work; past the pass's work cap
 * the walk stops and reports `limited`.
 */

/** A cell position the graph walks from. */
export interface GraphCell {
  readonly key: string;
  readonly sheet: string;
  readonly row: number;
  readonly col: number;
}

/** The static dependencies of one formula, resolved to positions and keys. */
export interface FormulaDependencies {
  /** Cell keys of single-cell references. */
  readonly cells: readonly string[];
  /** Intervals of ranges (0-based, inclusive). */
  readonly ranges: readonly {
    readonly sheet: string;
    readonly r1: number;
    readonly r2: number;
    readonly c1: number;
    readonly c2: number;
  }[];
}

interface Interval {
  readonly r1: number;
  readonly r2: number;
  readonly formula: string;
}

interface Registered {
  readonly cells: readonly string[];
  readonly columns: readonly { sheet: string; col: number; interval: Interval }[];
}

/** The result of a dirty walk: formulas to evaluate in order, and the cycles found. */
export interface DirtyOrder {
  /** Formula keys in evaluation order (cycle members excluded). */
  readonly order: readonly string[];
  /** Formula keys that sit on a cycle (they show `#CYCLE!`). */
  readonly cycles: readonly string[];
  /** Every dirty formula key (set when the walk was limited). */
  readonly dirty: readonly string[];
  /** Dependents and intervals visited. */
  readonly work: number;
  /** The walk crossed the work cap: every dirty formula is `#LIMIT!`. */
  readonly limited: boolean;
}

export class DependencyGraph {
  private readonly single = new Map<string, Set<string>>();
  private readonly columns = new Map<string, Map<number, Set<Interval>>>();
  private readonly registered = new Map<string, Registered>();

  /** How many formulas are registered. */
  get size(): number {
    return this.registered.size;
  }

  /** Register (or replace) the dependencies of a formula. */
  set(formula: string, deps: FormulaDependencies): void {
    this.delete(formula);
    const cells: string[] = [];
    for (const key of deps.cells) {
      let set = this.single.get(key);
      if (!set) {
        set = new Set();
        this.single.set(key, set);
      }
      set.add(formula);
      cells.push(key);
    }
    const columns: { sheet: string; col: number; interval: Interval }[] = [];
    for (const range of deps.ranges) {
      let bySheet = this.columns.get(range.sheet);
      if (!bySheet) {
        bySheet = new Map();
        this.columns.set(range.sheet, bySheet);
      }
      const interval: Interval = { r1: range.r1, r2: range.r2, formula };
      for (let col = range.c1; col <= range.c2; col += 1) {
        let set = bySheet.get(col);
        if (!set) {
          set = new Set();
          bySheet.set(col, set);
        }
        set.add(interval);
        columns.push({ sheet: range.sheet, col, interval });
      }
    }
    this.registered.set(formula, { cells, columns });
  }

  /** Forget a formula's dependencies. */
  delete(formula: string): void {
    const entry = this.registered.get(formula);
    if (!entry) return;
    for (const key of entry.cells) {
      const set = this.single.get(key);
      set?.delete(formula);
      if (set && set.size === 0) this.single.delete(key);
    }
    for (const { sheet, col, interval } of entry.columns) {
      const set = this.columns.get(sheet)?.get(col);
      set?.delete(interval);
      if (set && set.size === 0) this.columns.get(sheet)?.delete(col);
    }
    this.registered.delete(formula);
  }

  /** Forget everything. */
  clear(): void {
    this.single.clear();
    this.columns.clear();
    this.registered.clear();
  }

  /**
   * Call `visit` for every formula that reads a cell. Returns the work done
   * (dependents plus intervals scanned).
   */
  dependents(cell: GraphCell, visit: (formula: string) => void): number {
    let work = 0;
    const direct = this.single.get(cell.key);
    if (direct) {
      for (const formula of direct) {
        work += 1;
        visit(formula);
      }
    }
    const intervals = this.columns.get(cell.sheet)?.get(cell.col);
    if (intervals) {
      for (const interval of intervals) {
        work += 1;
        if (cell.row >= interval.r1 && cell.row <= interval.r2) visit(interval.formula);
      }
    }
    return work;
  }

  /**
   * Every formula downstream of the changed cells (plus the changed cells
   * that are formulas), in evaluation order, with cycles separated out.
   * `locate` gives a formula's own position (formulas are cells too).
   */
  dirtyOrder(
    changed: readonly GraphCell[],
    locate: (formula: string) => GraphCell | null,
    workCap: number
  ): DirtyOrder {
    const seen = new Set<string>();
    const queue: GraphCell[] = [];
    for (const cell of changed) {
      if (this.registered.has(cell.key)) seen.add(cell.key);
      queue.push(cell);
    }
    const edges = new Map<string, string[]>();
    let work = 0;
    while (queue.length > 0) {
      const cell = queue.pop() as GraphCell;
      const from = seen.has(cell.key) ? cell.key : null;
      work += this.dependents(cell, (formula) => {
        if (from !== null) {
          let list = edges.get(from);
          if (!list) {
            list = [];
            edges.set(from, list);
          }
          list.push(formula);
        }
        if (!seen.has(formula)) {
          seen.add(formula);
          const at = locate(formula);
          if (at) queue.push(at);
        }
      });
      if (work > workCap) {
        return { order: [], cycles: [], dirty: [...seen], work, limited: true };
      }
    }

    // Kahn over the dirty formulas.
    const indegree = new Map<string, number>();
    for (const key of seen) indegree.set(key, 0);
    for (const list of edges.values()) {
      for (const to of list) indegree.set(to, (indegree.get(to) ?? 0) + 1);
    }
    const order: string[] = [];
    const ready: string[] = [];
    for (const [key, n] of indegree) if (n === 0) ready.push(key);
    const release = (key: string) => {
      for (const to of edges.get(key) ?? []) {
        const n = (indegree.get(to) ?? 0) - 1;
        indegree.set(to, n);
        if (n === 0) ready.push(to);
      }
    };
    // FIFO, so independent formulas evaluate in sheet order.
    let head = 0;
    while (head < ready.length) {
      const key = ready[head++] as string;
      order.push(key);
      release(key);
    }
    if (order.length === seen.size) {
      return { order, cycles: [], dirty: order, work, limited: false };
    }

    // The rest sits on or behind a cycle: Tarjan finds the cycles.
    const rest = new Set([...seen].filter((key) => (indegree.get(key) ?? 0) > 0));
    const cycles = findCycles(rest, edges);
    // Cycle members are settled (#CYCLE!); what follows them evaluates after.
    for (const key of cycles) {
      for (const to of edges.get(key) ?? []) {
        if (!rest.has(to)) continue;
        const n = (indegree.get(to) ?? 0) - 1;
        indegree.set(to, n);
      }
    }
    const cycleSet = new Set(cycles);
    for (const key of rest) {
      if (!cycleSet.has(key) && (indegree.get(key) ?? 0) === 0) ready.push(key);
    }
    while (head < ready.length) {
      const key = ready[head++] as string;
      if (cycleSet.has(key)) continue;
      order.push(key);
      release(key);
    }
    return { order, cycles, dirty: [...seen], work, limited: false };
  }
}

/** Members of strongly connected components that form cycles (size > 1, or a self edge). Iterative. */
function findCycles(
  nodes: ReadonlySet<string>,
  edges: ReadonlyMap<string, readonly string[]>
): string[] {
  let counter = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: string[] = [];
  for (const start of nodes) {
    if (index.has(start)) continue;
    const targetsOf = (node: string) => (edges.get(node) ?? []).filter((to) => nodes.has(to));
    const frames: { node: string; next: number; targets: string[] }[] = [
      { node: start, next: 0, targets: targetsOf(start) },
    ];
    index.set(start, counter);
    low.set(start, counter);
    counter += 1;
    stack.push(start);
    onStack.add(start);
    while (frames.length > 0) {
      const frame = frames[frames.length - 1] as { node: string; next: number; targets: string[] };
      const targets = frame.targets;
      if (frame.next < targets.length) {
        const to = targets[frame.next] as string;
        frame.next += 1;
        if (!index.has(to)) {
          index.set(to, counter);
          low.set(to, counter);
          counter += 1;
          stack.push(to);
          onStack.add(to);
          frames.push({ node: to, next: 0, targets: targetsOf(to) });
        } else if (onStack.has(to)) {
          low.set(frame.node, Math.min(low.get(frame.node) as number, index.get(to) as number));
        }
        continue;
      }
      frames.pop();
      const parent = frames[frames.length - 1];
      if (parent)
        low.set(
          parent.node,
          Math.min(low.get(parent.node) as number, low.get(frame.node) as number)
        );
      if (low.get(frame.node) === index.get(frame.node)) {
        const component: string[] = [];
        for (;;) {
          const member = stack.pop() as string;
          onStack.delete(member);
          component.push(member);
          if (member === frame.node) break;
        }
        const selfEdge = component.length === 1 && targets.includes(frame.node);
        if (component.length > 1 || selfEdge) out.push(...component);
      }
    }
  }
  return out;
}
