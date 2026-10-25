import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './kbd-code.css';

export const CODE_VARIANTS = ['inline', 'block'] as const;
export type CodeVariant = (typeof CODE_VARIANTS)[number];

export const codeClass = variants({
  base: 'tx-code',
  variants: {
    variant: {
      inline: 'tx-code--inline',
      block: 'tx-code--block',
    },
  },
  defaultVariants: { variant: 'inline' },
});

export const kbdClass = variants({
  base: 'tx-kbd',
});

export const COPY_BUTTON_SIZES = ['sm', 'md'] as const;
export type CopyButtonSize = (typeof COPY_BUTTON_SIZES)[number];

export const copyButtonClass = variants({
  base: 'tx-copy-button',
  variants: {
    size: {
      sm: 'tx-copy-button--sm',
      md: 'tx-copy-button--md',
    },
  },
  defaultVariants: { size: 'md' },
});
