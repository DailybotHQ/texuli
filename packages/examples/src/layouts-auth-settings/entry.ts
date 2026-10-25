import { defineExample } from '../registry.ts';

export const layoutsAuthSettingsExample = defineExample({
  id: 'layouts-auth-settings',
  title: 'Auth, onboarding and settings layouts',
  description:
    'Authentication split, onboarding wizard and settings shell — responsive and RTL. Fictional Harbor Labs copy.',
  tags: ['layouts', 'auth', 'wizard', 'settings', 'rtl', 'a11y'],
  component: 'texuli/layouts/auth-settings',
  props: ['form', 'steps', 'sections', 'mountScreen'],
  load: () => import('./LayoutsAuthSettingsDemo.svelte'),
});
