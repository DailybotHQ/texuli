/** A navigable item in the breadcrumb trail. */
export type BreadcrumbItem = {
  /** Visible label. */
  label: string;
  /** Optional href (URL policy). Omit for the current page. */
  href?: string;
  /** Marks the current page when set (defaults to the last item without href). */
  current?: boolean;
};
