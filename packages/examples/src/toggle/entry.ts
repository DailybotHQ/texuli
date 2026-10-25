import { defineExample } from '../registry.ts';

export const texuliToggleExample = defineExample({
  id: 'texuli-toggle',
  title: 'Toggle and ToggleGroup',
  description:
    'Styled pressable toggles and segmented groups (single and multiple) with variants, sizes, RTL and dark. Fictional labels only.',
  tags: ['texuli', 'toggle', 'toolbar', 'rtl', 'dark'],
  component: 'texuli/Toggle',
  props: ['pressed', 'variant', 'size', 'type', 'value', 'orientation'],
  load: () => import('./ToggleDemo.svelte'),
});
