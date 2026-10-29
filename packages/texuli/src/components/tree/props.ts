import type { TreeRoot, VisibleTreeNode } from '@texuli/primitives/tree';
import type { ComponentProps, Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { TreeDensity, TreeVariant } from './variants.ts';

type RootProps = ComponentProps<typeof TreeRoot>;

export type TreeViewProps = Omit<RootProps, 'item' | 'class' | 'aria-label'> &
  Pick<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** The rendered root element (bindable). */
    ref?: HTMLElement | null;
    label?: string;
    variant?: TreeVariant;
    density?: TreeDensity;
    item?: Snippet<[VisibleTreeNode]>;
  };
