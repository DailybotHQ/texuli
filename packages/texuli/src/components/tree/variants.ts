import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './tree.css';

/** Outer treatment for the tree. */
export const TREE_VARIANTS = ['default', 'bordered'] as const;
export type TreeVariant = (typeof TREE_VARIANTS)[number];

/** Row spacing, scaled by the theme's density token. */
export const TREE_DENSITIES = ['compact', 'default', 'comfortable'] as const;
export type TreeDensity = (typeof TREE_DENSITIES)[number];

export const treeViewClass = variants({
  base: 'tx-tree',
  variants: {
    variant: {
      default: '',
      bordered: 'tx-tree--bordered',
    },
    density: {
      compact: 'tx-tree--compact',
      default: '',
      comfortable: 'tx-tree--comfortable',
    },
  },
  defaultVariants: { variant: 'default', density: 'default' },
});
