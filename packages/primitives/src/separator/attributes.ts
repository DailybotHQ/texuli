/** A separator's direction. */
export type SeparatorOrientation = 'horizontal' | 'vertical';

export interface SeparatorAttributeOptions {
  orientation?: SeparatorOrientation;
  /**
   * `true`: purely visual, hidden from assistive technology (`role="none"`).
   * `false` (default): a semantic boundary between sections (`role="separator"`).
   */
  decorative?: boolean;
}

export interface SeparatorAttributes {
  role: 'separator' | 'none';
  'aria-orientation'?: 'vertical';
  'data-orientation': SeparatorOrientation;
  'data-separator-root': '';
}

/**
 * The attributes of a separator (WAI-ARIA APG, static separator). A semantic
 * separator has `role="separator"`; ARIA's default orientation is horizontal,
 * so `aria-orientation` is written only for a vertical one. A decorative
 * separator has `role="none"` and no ARIA state at all. `data-orientation`
 * is always there, for styling.
 */
export function separatorAttributes(options: SeparatorAttributeOptions = {}): SeparatorAttributes {
  const orientation: SeparatorOrientation =
    options.orientation === 'vertical' ? 'vertical' : 'horizontal';
  if (options.decorative) {
    return { role: 'none', 'data-orientation': orientation, 'data-separator-root': '' };
  }
  return {
    role: 'separator',
    ...(orientation === 'vertical' ? { 'aria-orientation': 'vertical' as const } : {}),
    'data-orientation': orientation,
    'data-separator-root': '',
  };
}
