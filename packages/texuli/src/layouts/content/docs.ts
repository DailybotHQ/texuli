import { registerLayout } from '../host/registry.ts';

export const loadDocsLayout = () => import('./DocsLayout.svelte');

registerLayout('docs', { load: loadDocsLayout, owner: 'content' });

export type { LayoutProps } from '../host/registry.ts';
