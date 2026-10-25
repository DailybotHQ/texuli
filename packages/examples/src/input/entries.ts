import { defineExample } from '../registry.ts';

export const texuliInputExample = defineExample({
  id: 'texuli-input',
  title: 'Input, InputGroup and Textarea',
  description:
    'Styled text fields with clearable input, adornment group, autosize textarea, character count, invalid and disabled states, RTL and dark. Fictional copy only.',
  tags: ['texuli', 'input', 'form', 'rtl', 'dark'],
  component: 'texuli/Input',
  props: ['value', 'clearable', 'autosize', 'invalid', 'disabled', 'start', 'end', 'maxlength'],
  load: () => import('./InputDemo.svelte'),
});
