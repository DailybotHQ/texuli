import { defineExample } from '../registry.ts';

/** The editable code field (D-G-022, new in 0.13.1). The demo loads lazily. */
export const blocksCodeFieldExample = defineExample({
  id: 'blocks-code-field',
  title: 'Code field',
  description:
    'An editable, syntax-highlighted code field: a real textarea over the owned tokenizer, with Tab indentation, Escape then Tab to leave, line numbers, wrapping, read-only and disabled states. Fictional content.',
  tags: ['blocks', 'code', 'form', 'dark'],
  component: 'blocks/CodeField',
  props: [
    'value',
    'language',
    'label',
    'placeholder',
    'readonly',
    'disabled',
    'rows',
    'wrap',
    'tabSize',
    'indentWith',
    'lineNumbers',
    'highlightLimit',
    'showKeyboardHint',
  ],
  load: () => import('./CodeFieldDemo.svelte'),
});
