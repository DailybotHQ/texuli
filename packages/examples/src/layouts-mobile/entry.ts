import { defineExample } from '../registry.ts';

const component = 'texuli/layouts/mobile';

/** Mobile layout examples (T-layouts-mobile). The demos load lazily. */
export const layoutsMobileExamples = [
  defineExample({
    id: 'layouts-mobile-tabs',
    title: 'Mobile tab bar layout',
    description:
      'A phone-sized app with a bottom tab bar, a More sheet for the sixth item, a primary action and stacked navigation with Back on a detail screen. Fictional sales app.',
    tags: ['layouts', 'mobile', 'navigation', 'tabs'],
    component,
    props: ['layout', 'nav', 'path', 'options'],
    load: () => import('./MobileTabsDemo.svelte'),
  }),
  defineExample({
    id: 'layouts-mobile-drawer',
    title: 'Mobile drawer layout',
    description:
      'The drawer layout at a desktop width on a detail screen: Back and the screen title in the header, and the whole navigation in a side drawer.',
    tags: ['layouts', 'mobile', 'navigation', 'drawer'],
    component,
    props: ['layout', 'nav', 'path', 'options'],
    load: () => import('./MobileDrawerDemo.svelte'),
  }),
  defineExample({
    id: 'layouts-mobile-rtl',
    title: 'Mobile tab bar layout, right to left',
    description:
      'The tab bar layout in a right-to-left document: the tabs, Back and its chevron mirror.',
    tags: ['layouts', 'mobile', 'rtl'],
    component,
    props: ['dir'],
    load: () => import('./MobileRtlDemo.svelte'),
  }),
] as const;
