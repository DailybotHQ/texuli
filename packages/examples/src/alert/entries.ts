import { defineExample } from '../registry.ts';

export const texuliAlertExample = defineExample({
  id: 'texuli-alert',
  title: 'Alert, Callout and Banner',
  description:
    'Inline alerts, documentation callouts and page banners with every tone, actions, dismiss, RTL and dark. Fictional copy only.',
  tags: ['texuli', 'alert', 'banner', 'callout', 'rtl', 'dark'],
  component: 'texuli/Alert',
  props: ['tone', 'title', 'text', 'actionLabel', 'actionHref', 'dismissible', 'layout'],
  load: () => import('./AlertDemo.svelte'),
});
