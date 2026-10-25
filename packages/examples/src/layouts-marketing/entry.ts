import { defineExample } from '../registry.ts';

/** Marketing layouts example (T-layouts-marketing). */
export const layoutsMarketingExample = defineExample({
  id: 'layouts-marketing',
  title: 'Marketing layouts',
  description:
    'Landing hero, pricing tiers (integer cents) and marketing sections on the shared marketing frame. Responsive and RTL-ready.',
  tags: ['layouts', 'marketing', 'landing', 'pricing', 'responsive', 'rtl', 'dark'],
  component: 'texuli/layouts/marketing',
  props: ['brandLabel', 'title', 'tiers', 'navLinks', 'primaryCta'],
  load: () => import('./LayoutsMarketingDemo.svelte'),
});
