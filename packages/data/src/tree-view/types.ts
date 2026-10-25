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
}
