import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './tabs-accordion.css';

export const TABS_VARIANTS = ['line', 'pills', 'enclosed'] as const;
export type TabsVariant = (typeof TABS_VARIANTS)[number];

export const TABS_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type TabsOrientation = (typeof TABS_ORIENTATIONS)[number];

export const tabsRootClass = variants({
  base: 'tx-tabs',
  variants: {
    orientation: {
      horizontal: 'tx-tabs--horizontal',
      vertical: 'tx-tabs--vertical',
    },
    variant: {
      line: 'tx-tabs--line',
      pills: 'tx-tabs--pills',
      enclosed: 'tx-tabs--enclosed',
    },
  },
  defaultVariants: { orientation: 'horizontal', variant: 'line' },
});

export const tabsListClass = variants({
  base: 'tx-tabs__list',
  variants: {
    variant: {
      line: 'tx-tabs__list--line',
      pills: 'tx-tabs__list--pills',
      enclosed: 'tx-tabs__list--enclosed',
    },
  },
  defaultVariants: { variant: 'line' },
});

export const tabsTriggerClass = variants({
  base: 'tx-tabs__trigger',
  variants: {
    variant: {
      line: 'tx-tabs__trigger--line',
      pills: 'tx-tabs__trigger--pills',
      enclosed: 'tx-tabs__trigger--enclosed',
    },
  },
  defaultVariants: { variant: 'line' },
});

export const accordionRootClass = variants({
  base: 'tx-accordion',
  variants: {
    variant: {
      default: 'tx-accordion--default',
      bordered: 'tx-accordion--bordered',
    },
  },
  defaultVariants: { variant: 'default' },
});

export const ACCORDION_VARIANTS = ['default', 'bordered'] as const;
export type AccordionVariant = (typeof ACCORDION_VARIANTS)[number];
