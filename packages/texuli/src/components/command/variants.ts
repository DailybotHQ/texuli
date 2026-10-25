import { type ClassValue } from '../../internal/cx.ts';
import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './command.css';

export const COMMAND_SIZES = ['sm', 'md', 'lg'] as const;
export type CommandSize = (typeof COMMAND_SIZES)[number];

export const COMMAND_VARIANTS = ['outline', 'soft'] as const;
export type CommandVariant = (typeof COMMAND_VARIANTS)[number];

export const commandRootClass = variants({
  base: 'tx-command',
  variants: {
    size: {
      sm: 'tx-command--sm',
      md: 'tx-command--md',
      lg: 'tx-command--lg',
    },
    variant: {
      outline: 'tx-command--outline',
      soft: 'tx-command--soft',
    },
  },
  defaultVariants: { size: 'md', variant: 'outline' },
});

export const commandInputRowClass = variants({
  base: 'tx-command__input-row',
  variants: {},
});

export const commandInputClass = variants({
  base: 'tx-command__input',
  variants: {},
});

export const commandListClass = variants({
  base: 'tx-command__list',
  variants: {},
});

export const commandGroupClass = variants({
  base: 'tx-command__group',
  variants: {},
});

export const commandGroupHeadingClass = variants({
  base: 'tx-command__group-heading',
  variants: {},
});

export function commandItemClass(input?: { class?: ClassValue; disabled?: boolean }): string {
  return ['tx-command__item', input?.disabled ? 'tx-command__item--disabled' : '', input?.class]
    .filter(Boolean)
    .join(' ');
}

export const commandEmptyClass = variants({
  base: 'tx-command__empty',
  variants: {},
});

export const commandLoadingClass = variants({
  base: 'tx-command__loading',
  variants: {},
});

export const commandPaletteClass = variants({
  base: 'tx-command-palette',
  variants: {
    size: {
      sm: 'tx-command-palette--sm',
      md: 'tx-command-palette--md',
      lg: 'tx-command-palette--lg',
    },
  },
  defaultVariants: { size: 'md' },
});

export const commandTriggerClass = variants({
  base: 'tx-command-trigger',
  variants: {
    size: {
      sm: 'tx-command-trigger--sm',
      md: 'tx-command-trigger--md',
      lg: 'tx-command-trigger--lg',
    },
    variant: {
      outline: 'tx-command-trigger--outline',
      soft: 'tx-command-trigger--soft',
    },
  },
  defaultVariants: { size: 'md', variant: 'outline' },
});
