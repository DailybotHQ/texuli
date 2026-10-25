import { variants } from '../../internal/variants.ts';
// Side-effect: recipe-only imports still get Input/Textarea chrome.
import './field.css';

/** Shared field variants for Input and Textarea (standalone chrome). */
export const fieldVariants = variants({
  base: 'tx-field',
  variants: {
    control: {
      input: 'tx-input',
      textarea: 'tx-textarea',
    },
  },
  defaultVariants: {
    control: 'input',
  },
});
