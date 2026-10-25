import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './table.css';

/** Row treatment: dividers only, zebra stripes, or a full cell grid. */
export const TABLE_VARIANTS = ['plain', 'striped', 'grid'] as const;
export type TableVariant = (typeof TABLE_VARIANTS)[number];

/** Cell padding, multiplied by the theme's `--tx-density`. */
export const TABLE_DENSITIES = ['compact', 'default', 'comfortable'] as const;
export type TableDensity = (typeof TABLE_DENSITIES)[number];

/**
 * When rows stack into labelled cards: never, below a 30rem container (`sm`)
 * or below a 40rem container (`md`). It follows the table's own width, not
 * the viewport, so a table in a narrow panel stacks too.
 */
export const TABLE_STACKS = ['never', 'sm', 'md'] as const;
export type TableStack = (typeof TABLE_STACKS)[number];

export const TABLE_ALIGNS = ['start', 'center', 'end'] as const;
export type TableAlign = (typeof TABLE_ALIGNS)[number];

export const tableClass = variants({
  base: 'tx-table',
  variants: {
    variant: {
      plain: '',
      striped: 'tx-table--striped',
      grid: 'tx-table--grid',
    },
    density: {
      compact: 'tx-table--compact',
      default: '',
      comfortable: 'tx-table--comfortable',
    },
    stack: {
      never: '',
      sm: 'tx-table--stack-sm',
      md: 'tx-table--stack-md',
    },
  },
  defaultVariants: { variant: 'plain', density: 'default', stack: 'never' },
});

export const tableCellClass = variants({
  base: '',
  variants: {
    align: {
      start: '',
      center: 'tx-table__cell--center',
      end: 'tx-table__cell--end',
    },
  },
  defaultVariants: { align: 'start' },
});
