/** Translatable labels for the file browser chrome and live region. */
export interface FileBrowserLabels {
  browser: string;
  root: string;
  breadcrumbs: string;
  layoutGroup: string;
  layoutGrid: string;
  layoutList: string;
  items: string;
  empty: string;
  preview: string;
  previewEmpty: string;
  openFolder: (name: string) => string;
  selectItem: (name: string) => string;
  size: string;
  modified: string;
  kind: string;
  selectedCount: (count: number) => string;
  announcement: (message: string) => string;
}
