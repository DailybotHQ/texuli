/**
 * Density-independent layout widths. Importing this module loads the
 * `.tx-w-*` utilities (`layout-widths.css`). Pane and column inline-size
 * use rem and `--tx-layout-*`; they do not multiply `--tx-density`.
 */
import './layout-widths.css';

export const LAYOUT_WIDTH_UTILITIES = [
  'tx-w-content',
  'tx-w-wide',
  'tx-w-full',
  'tx-w-pane',
  'tx-w-column',
] as const;
