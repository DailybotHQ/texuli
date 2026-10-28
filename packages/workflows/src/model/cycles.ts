import type { WorkflowEdge } from './types.ts';

/**
 * Find one edge on a cycle, or `undefined` for an acyclic graph. Kahn's
 * algorithm strips every node outside a cycle's reach; each node left has an
 * incoming edge from another node left, so walking those edges backwards
 * must revisit a node, and the loop walked is a cycle. Deterministic: the
 * walk starts at the smallest node id, follows the smallest edge id, and the
 * smallest edge id on the loop is returned.
 */
export function findCycleEdge(
  nodeIds: Iterable<string>,
  edges: Iterable<WorkflowEdge>
): string | undefined {
  const indegree = new Map<string, number>();
  const out = new Map<string, string[]>();
  const into = new Map<string, WorkflowEdge[]>();
  for (const id of nodeIds) indegree.set(id, 0);
  for (const edge of edges) {
    indegree.set(edge.to.node, (indegree.get(edge.to.node) ?? 0) + 1);
    const targets = out.get(edge.from.node);
    if (targets) targets.push(edge.to.node);
    else out.set(edge.from.node, [edge.to.node]);
    const sources = into.get(edge.to.node);
    if (sources) sources.push(edge);
    else into.set(edge.to.node, [edge]);
  }
  const queue = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id);
  for (let i = 0; i < queue.length; i++) {
    for (const next of out.get(queue[i] as string) ?? []) {
      const degree = (indegree.get(next) as number) - 1;
      indegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }
  if (queue.length === indegree.size) return undefined;
  const left = (id: string) => (indegree.get(id) ?? 0) > 0;
  let current = [...indegree.keys()].filter(left).sort()[0] as string;
  const visitedAt = new Map<string, number>();
  const walked: string[] = [];
  while (!visitedAt.has(current)) {
    visitedAt.set(current, walked.length);
    let step: WorkflowEdge | undefined;
    for (const edge of into.get(current) ?? []) {
      if (left(edge.from.node) && (step === undefined || edge.id < step.id)) step = edge;
    }
    const edge = step as WorkflowEdge;
    walked.push(edge.id);
    current = edge.from.node;
  }
  return walked.slice(visitedAt.get(current)).sort()[0];
}
