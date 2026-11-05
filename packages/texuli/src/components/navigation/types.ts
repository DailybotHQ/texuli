/** A navigable item in the breadcrumb trail. */
export type BreadcrumbItem = {
  /** Visible label. */
  label: string;
  /** Optional href (URL policy). Omit for the current page. */
  href?: string;
  /** Marks the current page when set (defaults to the last item without href). */
  current?: boolean;
  /** Accessible name of the link when the visible label is abbreviated (new in `0.14.0`). */
  ariaLabel?: string;
  /**
   * Called when the link is activated (new in `0.14.0`): `event.preventDefault()`
   * routes client-side; otherwise the link navigates normally.
   */
  onSelect?: (item: BreadcrumbItem, event: MouseEvent) => void;
};
