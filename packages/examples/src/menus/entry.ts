import { defineExample } from '../registry.ts';

export const texuliMenusExample = defineExample({
  id: 'texuli-menus',
  title: 'DropdownMenu, ContextMenu and Menubar',
  description:
    'Styled menus with shortcuts, checkbox and radio items, submenus, context regions and an application menubar. Fictional Harbor Notes chrome.',
  tags: ['texuli', 'menu', 'menubar', 'context-menu', 'a11y', 'rtl', 'dark'],
  component: 'texuli/DropdownMenu',
  props: ['open', 'variant', 'size', 'shortcut', 'icon'],
  load: () => import('./MenusDemo.svelte'),
});
