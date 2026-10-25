import { variants } from '../../internal/variants.ts';
// Side-effect: recipe-only imports (no Button component) still get the chrome.
import './button.css';

export const buttonVariants = variants({
  base: 'tx-button',
  variants: {
    variant: {
      default: 'tx-button--default',
      secondary: 'tx-button--secondary',
      outline: 'tx-button--outline',
      ghost: 'tx-button--ghost',
      destructive: 'tx-button--destructive',
      // link-size is folded in (canonical variants() has no compoundVariants).
      link: 'tx-button--link tx-button--link-size',
    },
    size: {
      sm: 'tx-button--sm',
      md: 'tx-button--md',
      lg: 'tx-button--lg',
      icon: 'tx-button--icon',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
});

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export const BUTTON_VARIANTS = [
  'default',
  'secondary',
  'outline',
  'ghost',
  'destructive',
  'link',
] as const satisfies readonly ButtonVariant[];

export const BUTTON_SIZES = ['sm', 'md', 'lg', 'icon'] as const satisfies readonly ButtonSize[];
