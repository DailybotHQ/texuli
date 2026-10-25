import { defineExample } from '../registry.ts';

export const texuliTooltipExample = defineExample({
  id: 'texuli-tooltip',
  title: 'Tooltip',
  description:
    'Styled tooltips with optional keyboard shortcut chips on the token contract. Fictional Harbor Notes copy.',
  tags: ['texuli', 'tooltip', 'a11y', 'rtl', 'dark'],
  component: 'texuli/Tooltip',
  props: ['content', 'shortcut', 'side', 'align', 'delayDuration', 'disabled', 'open'],
  load: () => import('./TooltipDemo.svelte'),
});
