import type { CatalogTreeInput } from '../render/renderer/types.ts';

/**
 * Address of a node: child indexes from the root. `[]` is the root,
 * `[0, 2]` is `root.children[0].children[2]`. Plain data, so ops serialize.
 */
export type NodePath = readonly number[];

/**
 * One RFC 6902 operation on a document (spec 0.7.0 `$defs.documentPatchOperation`).
 * `path` and `from` are RFC 6901 pointers into the document.
 */
export interface DocumentPatchOp {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  from?: string;
  value?: unknown;
}

/**
 * Applies a bounded RFC 6902 patch to a document and validates the result,
 * all or none: usually `applyDocumentPatch` from `@texuli/document/ops`
 * (injected, so this module stays free of the document engine). `inverse`
 * restores the input document exactly.
 */
export type DocumentPatcher = (
  doc: unknown,
  patch: readonly DocumentPatchOp[]
) =>
  | { ok: true; document: unknown; inverse: readonly DocumentPatchOp[] }
  | { ok: false; message: string };

/** Options for {@link EditOp} application. */
export interface ApplyEditOptions {
  /** Required by `patchDocument`; without it that op is refused (`invalid-op`). */
  patchDocument?: DocumentPatcher;
}

/**
 * The closed edit vocabulary for a blueprint tree. Every op is plain JSON,
 * so the builder, the agent service (as patches) and server-side hosts share
 * it. Unknown op kinds and fields are refused by {@link parseEditOp}.
 */
export type EditOp =
  /** Add `node` as child `index` of the node at `parent`. */
  | { op: 'insert'; parent: NodePath; index: number; node: CatalogTreeInput }
  /** Delete the subtree at `path` (never the root; use `replaceAll`). */
  | { op: 'remove'; path: NodePath }
  /**
   * Move the subtree at `path`. It is removed first; `parent` and `index`
   * address the tree **after** that removal, so a node can never be moved
   * into its own subtree.
   */
  | { op: 'move'; path: NodePath; parent: NodePath; index: number }
  /** Set one prop to a plain JSON value. */
  | { op: 'setProp'; path: NodePath; name: string; value: unknown }
  /** Remove one prop (a no-op when it is absent). */
  | { op: 'unsetProp'; path: NodePath; name: string }
  /** Replace the subtree at `path` (`[]` replaces the root). */
  | { op: 'replace'; path: NodePath; node: CatalogTreeInput }
  /** Replace the whole tree (a JSON commit, a template, a full agent turn). */
  | { op: 'replaceAll'; tree: CatalogTreeInput }
  /**
   * Apply a bounded RFC 6902 patch (at most 1,000 operations) to the `doc`
   * of the `document` node at `path`, or the node whose `key` is given
   * (spec 0.7.0): exactly one of `path` and `key`.
   */
  | {
      op: 'patchDocument';
      path?: NodePath;
      key?: string;
      patch: readonly DocumentPatchOp[];
    };

export type EditOpKind = EditOp['op'];

/** Why an op was refused. The tree is never changed by a refused op. */
export type EditErrorCode =
  | 'invalid-op'
  | 'invalid-node'
  | 'invalid-value'
  | 'path-not-found'
  | 'index-out-of-range'
  | 'root-op'
  | 'validation-failed';

export interface EditError {
  code: EditErrorCode;
  message: string;
  /** Index of the failing op in a batch. */
  opIndex?: number;
  /** Diagnostics from the commit gate, for `validation-failed`. */
  diagnostics?: readonly unknown[];
}

export type EditResult =
  | {
      ok: true;
      tree: CatalogTreeInput;
      /** Ops that restore the previous tree exactly, in the order to apply them. */
      inverse: readonly EditOp[];
      /** False when the ops left the tree unchanged. */
      changed: boolean;
    }
  | { ok: false; error: EditError };

/** Result of a host-supplied commit gate. */
export interface EditValidation {
  ok: boolean;
  diagnostics: readonly unknown[];
}
