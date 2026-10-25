import { defineExample } from '../registry.ts';

export const texuliToastExample = defineExample({
  id: 'texuli-toast',
  title: 'Toaster',
  description:
    'Styled toast stack with success, error, info, warning, actions, promise toasts, and RTL. Fictional Harbor copy only.',
  tags: ['texuli', 'toast', 'feedback', 'a11y'],
  component: 'texuli/Toaster',
  props: ['label', 'offset', 'store'],
  load: () => import('./ToastDemo.svelte'),
});

export const texuliToasterPositionsExample = defineExample({
  id: 'texuli-toaster-positions',
  title: 'Toaster positions',
  description:
    'Two styled toasters (top end and bottom start) with two toasts in each tone, logical placement and enter/exit motion. Fictional Harbor copy only.',
  tags: ['texuli', 'toast', 'feedback', 'a11y'],
  component: 'texuli/Toaster',
  props: ['position', 'label', 'offset', 'store'],
  load: () => import('./ToasterPositionsDemo.svelte'),
});
