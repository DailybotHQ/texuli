import { defineExample } from '../registry.ts';

/**
 * First registered example: URL policy demo used by the fixture app smoke path
 * for the examples catalog. Component tasks add sibling entry modules.
 */
export const coreSafeHrefExample = defineExample({
  id: 'core-safe-href',
  title: 'safeHref blocks unsafe URLs',
  description:
    'Shows how safeHref keeps https and mailto links and drops javascript: schemes. Fictional example.com only.',
  tags: ['core', 'url', 'security'],
  component: 'core/safeHref',
  props: ['value', 'trust'],
  load: () => import('../demos/SafeHrefDemo.svelte'),
});
