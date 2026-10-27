/** Translatable labels used by the tree data view controls and live region. */
export interface TreeDataViewLabels {
  tree: string;
  instructions: string;
  dragHandle: (itemLabel: string) => string;
  expand: (itemLabel: string) => string;
  collapse: (itemLabel: string) => string;
  checkbox: (itemLabel: string) => string;
  loadingChildren: string;
  loadError: string;
  empty: string;
  savingMove: string;
  announcement: (message: string) => string;
  collapsed: (itemLabel: string) => string;
  expanded: (itemLabel: string) => string;
  /** Announced after a keyboard reorder, indent or outdent. */
  moved: (itemLabel: string) => string;
  /** Announced after a pointer drop; `parentLabel` is `topLevel` for root rows. */
  movedUnder: (itemLabel: string, parentLabel: string) => string;
  topLevel: string;
  /** Announced when the host's `onMove` fails and the row returns. */
  moveFailed: (itemLabel: string) => string;
}
