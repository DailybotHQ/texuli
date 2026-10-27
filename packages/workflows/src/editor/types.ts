import type { NodeTypeSpec, WorkflowNode } from '../model/types.ts';

/**
 * What a custom node snippet receives. The editor owns the node frame,
 * ports, focus and selection; the snippet renders the body as text. Links
 * and images must pass `safeHref` / `safeImageSrc` (the `untrusted` tier).
 */
export interface WorkflowNodeContext {
  node: WorkflowNode;
  /** The node's type from the closed registry. */
  spec: NodeTypeSpec | undefined;
  selected: boolean;
  focused: boolean;
  readonly: boolean;
  safeHref: (value: unknown) => string | undefined;
  safeImageSrc: (value: unknown) => string | undefined;
}
