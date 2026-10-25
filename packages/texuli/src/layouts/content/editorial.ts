import { registerLayout } from '../host/registry.ts';

export const loadEditorialLayout = () => import('./EditorialLayout.svelte');

registerLayout('editorial', { load: loadEditorialLayout, owner: 'content' });

export type { LayoutProps } from '../host/registry.ts';
