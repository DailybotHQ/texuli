import { registerLayout } from '../host/registry.ts';

export const loadBlogLayout = () => import('./BlogLayout.svelte');

registerLayout('blog', { load: loadBlogLayout, owner: 'content' });

export type { LayoutProps } from '../host/registry.ts';
